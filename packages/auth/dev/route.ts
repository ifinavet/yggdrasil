import "server-only";

import {
	DEV_AUTH_COOKIE,
	DEV_AUTH_SESSION_TTL_SECONDS,
	DEV_USERS,
} from "@workspace/shared/constants";
import { isMockAuth } from "../mode";
import { devAuthConfigured, findDevUser, mintDevToken } from "./signing";

type RouteContext = { params: Promise<{ route?: string[] }> };

function isEnabled(): boolean {
	return isMockAuth && devAuthConfigured() && !process.env.VERCEL;
}

function currentDevUser(request: Request) {
	const cookies = request.headers.get("cookie") ?? "";

	const value = cookies
		.split(";")
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${DEV_AUTH_COOKIE}=`))
		?.slice(DEV_AUTH_COOKIE.length + 1);

	return findDevUser(value ? decodeURIComponent(value) : undefined);
}

function json(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
	if (!isEnabled()) return new Response(null, { status: 404 });

	const { route } = await context.params;
	const user = currentDevUser(request);

	switch (route?.[0]) {
		case "session":
			return json({ user: user ?? null, users: DEV_USERS });

		case "token": {
			if (!user) return new Response(null, { status: 401 });

			try {
				return json({ token: await mintDevToken(user) });
			} catch (error) {
				console.error("Failed to mint a development token", error);
				return json({ error: "Could not mint a development token" }, { status: 500 });
			}
		}

		default:
			return new Response(null, { status: 404 });
	}
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
	if (!isEnabled()) return new Response(null, { status: 404 });

	const { route } = await context.params;

	switch (route?.[0]) {
		case "sign-in": {
			const body = await request.json().catch(() => null);
			const user = findDevUser(typeof body?.externalId === "string" ? body.externalId : undefined);
			if (!user) {
				return json({ error: "Unknown development user" }, { status: 400 });
			}

			return json(
				{ user },
				{
					headers: {
						"Set-Cookie": `${DEV_AUTH_COOKIE}=${encodeURIComponent(user.externalId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DEV_AUTH_SESSION_TTL_SECONDS}`,
					},
				},
			);
		}

		case "sign-out":
			return json(
				{ user: null },
				{
					headers: {
						"Set-Cookie": `${DEV_AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
					},
				},
			);

		default:
			return new Response(null, { status: 404 });
	}
}
