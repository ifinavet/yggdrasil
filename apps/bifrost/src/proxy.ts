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

export const proxy = isMockAuth
	? searchParamsMiddleware
	: clerkMiddleware(async (_, req) => searchParamsMiddleware(req));

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
