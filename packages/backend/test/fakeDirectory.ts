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
type Call = { method: string; url: string; body: unknown };
export type FakeRequest = Readonly<{ url: URL; method: string; body?: string | URLSearchParams }>;

const USERS_PATH = "/admin/directory/v1/users";
const SLACK_PATH = "/api/";

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

export function createFakeDirectory() {
	const google = new Map<string, FakeGoogleUser>();
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
		return json({ ok: false, error: "unknown_method" });
	}

	function handle({ url, method, body }: FakeRequest) {
		if (url.pathname === "/token") {
			calls.push({ method, url: url.toString(), body: null });
			return json({ access_token: "google-token", expires_in: 3600 });
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

	return { google, slackUsers, calls, failures, renameGoogle, handle };
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
		const answer = directory.handle({ url, method, body: Buffer.concat(chunks).toString() });
		response.writeHead(answer?.status ?? 404, { "Content-Type": "application/json" });
		response.end(answer ? await answer.text() : "{}");
	}).listen(port, "127.0.0.1", () =>
		console.log(`Fake Google and Slack on http://127.0.0.1:${port}`),
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) serve(Number(process.env.PORT ?? 3299));
