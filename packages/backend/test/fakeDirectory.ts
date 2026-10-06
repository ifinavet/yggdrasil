import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export type FakeGoogleUser = {
	name: string;
	suspended: boolean;
	password?: string;
	signedIn?: boolean;
	id?: string;
};
export type FakeSlackUser = {
	id: string;
	email: string;
	name: string;
	deleted?: boolean;
	bot?: boolean;
};
export type FakeCalendarEvent = Record<string, unknown> & {
	id: string;
	status?: string;
	transparency?: string;
	start?: { dateTime?: string };
	end?: { dateTime?: string };
};
type FakeSlackChannel = {
	id: string;
	name: string;
	is_private: boolean;
	is_archived: boolean;
	creator: string;
	purpose: { value: string };
	members: string[];
	messages: Record<string, unknown>[];
};
type Call = { method: string; url: string; body: unknown };
export type FakeRequest = Readonly<{
	url: URL;
	method: string;
	body?: string | URLSearchParams;
	authorization?: string;
}>;

const USERS_PATH = "/admin/directory/v1/users";
const SLACK_PATH = "/api/";
const CALENDAR_PATH = "/calendar/v3/";
const TOKEN_PREFIX = "fake-google:";
const SLACK_BOT_ID = "UBOT";
const FAKE_CALENDARS = [
	{ id: "navet", summary: "Navet" },
	{ id: "timetable", summary: "Timeplan" },
	{ id: "private", summary: "Privat" },
];

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function directoryUser(email: string, user: FakeGoogleUser) {
	user.id ??= `google-${email}`;
	return {
		id: user.id,
		primaryEmail: email,
		name: { fullName: user.name },
		suspended: user.suspended,
		lastLoginTime: user.signedIn ? "2026-01-15T10:00:00.000Z" : "1970-01-01T00:00:00.000Z",
	};
}

function tokenSubject(body: FakeRequest["body"]) {
	const assertion = new URLSearchParams(body).get("assertion");
	const payload = assertion?.split(".")[1];
	if (!payload) return "";
	const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string };
	return claims.sub ?? "";
}

function overlaps(event: FakeCalendarEvent, from: number, to: number) {
	const start = Date.parse(event.start?.dateTime ?? "");
	const end = Date.parse(event.end?.dateTime ?? "");
	return start < to && from < end;
}

function blocksTime(event: FakeCalendarEvent) {
	return event.status !== "cancelled" && event.transparency !== "transparent";
}

export function createFakeDirectory() {
	const google = new Map<string, FakeGoogleUser>();
	const calendarEvents = new Map<string, Map<string, FakeCalendarEvent>>();
	const slackChannels = new Map<string, FakeSlackChannel>();
	const slackUsers: FakeSlackUser[] = [];
	const calls: Call[] = [];
	const failures = { google: false, slack: false };
	const aliases = new Map<string, string>();

	function resolveGoogle(key: string) {
		if (google.has(key)) return key;
		const alias = aliases.get(key);
		if (alias) return alias;
		return [...google].find(([address, user]) => directoryUser(address, user).id === key)?.[0];
	}

	function renameGoogle(from: string, to: string, keepAlias = true) {
		const user = google.get(from);
		if (!user) throw new Error(`No Google user ${from}`);
		directoryUser(from, user);
		google.delete(from);
		google.set(to, user);
		if (keepAlias) aliases.set(from, to);
	}

	function handleGoogle(method: string, url: URL, body: Record<string, unknown>) {
		if (failures.google) return json({ error: "down" }, 503);
		const key = decodeURIComponent(url.pathname.split("/users/")[1] ?? "");
		const email = key ? (resolveGoogle(key) ?? key) : "";
		if (method === "POST" && !email) {
			const primaryEmail = String(body.primaryEmail);
			if (google.has(primaryEmail)) return json({ error: "exists" }, 409);
			const name = body.name as { givenName: string; familyName: string };
			google.set(primaryEmail, {
				name: `${name.givenName} ${name.familyName}`,
				suspended: false,
				password: String(body.password),
			});
			return json(directoryUser(primaryEmail, google.get(primaryEmail) as FakeGoogleUser), 201);
		}
		if (!email) {
			return json({ users: [...google].map(([address, user]) => directoryUser(address, user)) });
		}
		const user = google.get(email);
		if (!user) return json({ error: "not found" }, 404);
		if (method === "PATCH") {
			if (typeof body.suspended === "boolean") user.suspended = body.suspended;
			if (typeof body.password === "string") user.password = body.password;
		}
		return json(directoryUser(email, user));
	}

	function eventsOf(subject: string, calendarId: string) {
		const key = `${subject}/${calendarId}`;
		const events = calendarEvents.get(key) ?? new Map<string, FakeCalendarEvent>();
		calendarEvents.set(key, events);
		return events;
	}

	function freeBusy(subject: string, body: Record<string, unknown>) {
		const from = Date.parse(String(body.timeMin));
		const to = Date.parse(String(body.timeMax));
		const items = (body.items ?? []) as Array<{ id: string }>;
		const calendars = Object.fromEntries(
			items.map(({ id }) => [
				id,
				{
					busy: [...eventsOf(subject, id).values()]
						.filter((event) => blocksTime(event) && overlaps(event, from, to))
						.map((event) => ({ start: event.start?.dateTime, end: event.end?.dateTime })),
				},
			]),
		);
		return json({ calendars });
	}

	function handleEvent(
		method: string,
		events: Map<string, FakeCalendarEvent>,
		eventId: string,
		body: Record<string, unknown>,
	) {
		const existing = events.get(eventId);
		if (method === "DELETE") {
			if (!existing) return json({ error: "not found" }, 404);
			events.delete(eventId);
			return new Response(null, { status: 204 });
		}
		if (!existing) return json({ error: "not found" }, 404);
		if (method === "PUT") events.set(eventId, { ...body, id: eventId });
		return json(events.get(eventId));
	}

	function handleCalendar(
		method: string,
		url: URL,
		authorization: string | undefined,
		body: Record<string, unknown>,
	) {
		if (failures.google) return json({ error: "down" }, 503);
		const subject = authorization?.split(TOKEN_PREFIX)[1] ?? "";
		if (!subject) return json({ error: "unauthorized" }, 401);
		const path = url.pathname.slice(CALENDAR_PATH.length).split("/").map(decodeURIComponent);
		if (path.join("/") === "users/me/calendarList") return json({ items: FAKE_CALENDARS });
		if (path.join("/") === "freeBusy") return freeBusy(subject, body);
		const [kind, calendarId = "", collection, eventId] = path;
		if (kind !== "calendars" || collection !== "events") return null;
		const events = eventsOf(subject, calendarId);
		if (eventId) return handleEvent(method, events, eventId, body);
		if (method === "POST") {
			const id = String(body.id ?? `event${events.size + 1}`);
			if (events.has(id)) return json({ error: "exists" }, 409);
			events.set(id, { ...body, id });
			return json(events.get(id));
		}
		const from = Date.parse(url.searchParams.get("timeMin") ?? "");
		const to = Date.parse(url.searchParams.get("timeMax") ?? "");
		return json({
			timeZone: "Europe/Oslo",
			items: [...events.values()].filter((event) => overlaps(event, from, to)),
		});
	}

	function handleSlack(method: string, params: URLSearchParams) {
		if (failures.slack) return json({ ok: false, error: "service_unavailable" });
		if (method === "users.lookupByEmail") {
			const user = slackUsers.find((candidate) => candidate.email === params.get("email"));
			return json(
				user ? { ok: true, user: { id: user.id } } : { ok: false, error: "users_not_found" },
			);
		}
		if (method === "users.list") {
			return json({
				ok: true,
				members: slackUsers.map((user) => ({
					id: user.id,
					deleted: user.deleted ?? false,
					is_bot: user.bot ?? false,
					profile: { email: user.email, real_name: user.name },
				})),
			});
		}
		if (method === "auth.test") return json({ ok: true, user_id: SLACK_BOT_ID });
		if (method === "conversations.create") {
			const name = params.get("name") ?? "";
			if ([...slackChannels.values()].some((channel) => channel.name === name))
				return json({ ok: false, error: "name_taken" });
			const id = `C${String(slackChannels.size + 1).padStart(3, "0")}`;
			slackChannels.set(id, {
				id,
				name,
				is_private: true,
				is_archived: false,
				creator: SLACK_BOT_ID,
				purpose: { value: "" },
				members: [SLACK_BOT_ID],
				messages: [],
			});
			return json({ ok: true, channel: { id } });
		}
		if (method === "conversations.list")
			return json({ ok: true, channels: [...slackChannels.values()] });
		const channel = slackChannels.get(params.get("channel") ?? "");
		if (!channel) return json({ ok: false, error: "channel_not_found" });
		if (method === "conversations.info") return json({ ok: true, channel });
		if (method === "conversations.members") return json({ ok: true, members: channel.members });
		if (method === "conversations.setPurpose") {
			channel.purpose = { value: params.get("purpose") ?? "" };
			return json({ ok: true });
		}
		if (method === "conversations.rename") {
			channel.name = params.get("name") ?? channel.name;
			return json({ ok: true });
		}
		if (method === "conversations.archive") {
			channel.is_archived = true;
			return json({ ok: true });
		}
		if (method === "conversations.invite") {
			const users = (params.get("users") ?? "").split(",").filter(Boolean);
			if (users.every((user) => channel.members.includes(user)))
				return json({ ok: false, error: "already_in_channel" });
			channel.members.push(...users.filter((user) => !channel.members.includes(user)));
			return json({ ok: true });
		}
		if (method === "conversations.kick") {
			const user = params.get("user") ?? "";
			if (!channel.members.includes(user)) return json({ ok: false, error: "not_in_channel" });
			channel.members = channel.members.filter((member) => member !== user);
			return json({ ok: true });
		}
		if (method === "conversations.history") return json({ ok: true, messages: channel.messages });
		if (method === "chat.postMessage") {
			const ts = `${Date.now() / 1000}`;
			const metadata = params.get("metadata");
			channel.messages.unshift({
				ts,
				text: params.get("text") ?? "",
				client_msg_id: params.get("client_msg_id") ?? undefined,
				metadata: metadata ? JSON.parse(metadata) : undefined,
			});
			return json({ ok: true, ts, channel: channel.id });
		}
		return json({ ok: false, error: "unknown_method" });
	}

	function handle({ url, method, body, authorization }: FakeRequest) {
		if (url.pathname === "/token") {
			calls.push({ method, url: url.toString(), body: null });
			return json({ access_token: `${TOKEN_PREFIX}${tokenSubject(body)}`, expires_in: 3600 });
		}
		if (url.pathname.startsWith(CALENDAR_PATH)) {
			const parsed = typeof body === "string" && body ? JSON.parse(body) : {};
			calls.push({ method, url: url.toString(), body: parsed });
			return handleCalendar(method, url, authorization, parsed);
		}
		if (url.pathname.startsWith(USERS_PATH)) {
			const parsed = typeof body === "string" && body ? JSON.parse(body) : {};
			calls.push({ method, url: url.toString(), body: parsed });
			return handleGoogle(method, url, parsed);
		}
		if (url.pathname.startsWith(SLACK_PATH)) {
			const params = new URLSearchParams(body);
			const slackMethod = url.pathname.slice(SLACK_PATH.length);
			calls.push({ method: slackMethod, url: url.toString(), body: Object.fromEntries(params) });
			return handleSlack(slackMethod, params);
		}
		return null;
	}

	function reset() {
		google.clear();
		slackUsers.length = 0;
		calendarEvents.clear();
		slackChannels.clear();
		aliases.clear();
		calls.length = 0;
		failures.google = false;
		failures.slack = false;
	}

	return {
		google,
		slackUsers,
		calendarEvents,
		slackChannels,
		calls,
		failures,
		renameGoogle,
		handle,
		reset,
	};
}

function seed(directory: ReturnType<typeof createFakeDirectory>) {
	const people: [string, FakeGoogleUser][] = [
		["admin@ifinavet.no", { name: "Navet Admin", suspended: false, signedIn: true }],
		["leder@ifinavet.no", { name: "Leder Navet", suspended: false, signedIn: true }],
		["ingrid.berg@ifinavet.no", { name: "Ingrid Berg", suspended: false, signedIn: true }],
		["jonas.lie@ifinavet.no", { name: "Jonas Lie", suspended: false, signedIn: true }],
		["sara.holm@ifinavet.no", { name: "Sara Holm", suspended: false, signedIn: true }],
		["per.hansen@ifinavet.no", { name: "Per Hansen", suspended: true, signedIn: true }],
		["mia.strand@ifinavet.no", { name: "Mia Strand", suspended: true, signedIn: true }],
		["ola.nordmann@ifinavet.no", { name: "Ola Gammelsen", suspended: false, signedIn: true }],
		["kristine.as@ifinavet.no", { name: "Kristine Ås", suspended: false, signedIn: true }],
		["nora.vik@ifinavet.no", { name: "Nora Vik", suspended: false, signedIn: false }],
		["lars.ek@ifinavet.no", { name: "Lars Ek", suspended: false, signedIn: true }],
		["hanna.lund@ifinavet.no", { name: "Hanna Lund", suspended: false, signedIn: false }],
		["kristian.moe@ifinavet.no", { name: "Kristian Moe", suspended: true, signedIn: true }],
		["eirik.sand@ifinavet.no", { name: "Eirik Sand", suspended: false, signedIn: true }],
		["thea.solli@ifinavet.no", { name: "Thea Solli", suspended: true, signedIn: true }],
		["snik@ifinavet.no", { name: "Ukjent Snik", suspended: false, signedIn: true }],
	];
	for (const [email, user] of people) directory.google.set(email, user);
	directory.slackUsers.push(
		{ id: "U001", email: "leder@ifinavet.no", name: "Leder Navet" },
		{ id: "U002", email: "ingrid.berg@ifinavet.no", name: "Ingrid Berg" },
		{ id: "U003", email: "jonas.lie@ifinavet.no", name: "Jonas Lie" },
		{ id: "U004", email: "sara.holm@ifinavet.no", name: "Sara Holm" },
		{ id: "U005", email: "per.hansen@ifinavet.no", name: "Per Hansen" },
		{ id: "U006", email: "mia.strand@ifinavet.no", name: "Mia Strand", deleted: true },
		{ id: "U007", email: "nora.vik@ifinavet.no", name: "Nora Vik" },
		{ id: "U008", email: "gjest@gmail.com", name: "Gjest Utenfra" },
		{ id: "U009", email: "kristian.moe@ifinavet.no", name: "Kristian Moe" },
		{ id: "U010", email: "eirik.sand@ifinavet.no", name: "Eirik Sand" },
		{ id: "U011", email: "kristin.berg@ifinavet.no", name: "Kristin Berg" },
		{ id: "U012", email: "daniel.holm@ifinavet.no", name: "Daniel Holm" },
		{ id: "U013", email: "aksel.nilsen@ifinavet.no", name: "Aksel Nilsen" },
		{ id: "B001", email: "bot@ifinavet.no", name: "Navet-bot", bot: true },
	);
}

function serve(port: number) {
	const directory = createFakeDirectory();
	seed(directory);
	createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
		const method = request.method ?? "GET";
		if (url.pathname === "/fail" || url.pathname === "/status") {
			for (const service of ["google", "slack"] as const) {
				const value = url.pathname === "/fail" ? url.searchParams.get(service) : null;
				if (value !== null) directory.failures[service] = value === "1";
			}
			console.log(url.pathname, JSON.stringify(directory.failures));
			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify(directory.failures));
			return;
		}
		if (url.pathname === "/reset") {
			directory.reset();
			seed(directory);
			response.writeHead(204).end();
			return;
		}
		if (url.pathname === "/state") {
			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(
				JSON.stringify({
					google: Object.fromEntries(directory.google),
					slackChannels: [...directory.slackChannels.values()],
					calendarEvents: Object.fromEntries(
						[...directory.calendarEvents].map(([key, events]) => [key, [...events.values()]]),
					),
				}),
			);
			return;
		}
		const answer = directory.handle({
			url,
			method,
			body: Buffer.concat(chunks).toString(),
			authorization: request.headers.authorization,
		});
		response.writeHead(answer?.status ?? 404, { "Content-Type": "application/json" });
		response.end(answer ? await answer.text() : "{}");
	}).listen(port, "127.0.0.1", () =>
		console.log(`Fake Google and Slack on http://127.0.0.1:${port}`),
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) serve(Number(process.env.PORT ?? 3299));
