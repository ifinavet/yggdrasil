import { type NextRequest, NextResponse } from "next/server";

export const ENTRY_PATH = "/events";

export function entryRedirect(request: NextRequest): NextResponse | undefined {
	const navigatedWithinBifrost = request.headers.get("sec-fetch-site") === "same-origin";
	if (request.nextUrl.pathname !== "/" || navigatedWithinBifrost) return undefined;
	return NextResponse.redirect(new URL(ENTRY_PATH, request.url));
}
