import { clerkMiddleware } from "@clerk/nextjs/server";
import { isMockAuth } from "@workspace/auth/mode";
import { type NextRequest, NextResponse } from "next/server";

const searchParamsMiddleware = (request: NextRequest) => {
	return NextResponse.next({
		headers: {
			"x-searchParams": request.nextUrl.searchParams.toString(),
			"x-pathname": request.nextUrl.pathname,
		},
	});
};

export default isMockAuth
	? searchParamsMiddleware
	: clerkMiddleware(async (_auth, req: NextRequest) => searchParamsMiddleware(req));

export const config = {
	matcher: [
		// Run on all routes except Next.js internals so Clerk middleware is detected on error/asset/404 requests
		"/((?!_next).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
