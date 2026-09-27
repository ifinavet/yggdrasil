import { clerkMiddleware } from "@clerk/nextjs/server";
import { isLocalDevelopment } from "@workspace/auth/local";
import { type NextRequest, NextResponse } from "next/server";
import { entryRedirect } from "@/lib/entry-redirect";

const searchParamsMiddleware = (request: NextRequest) => {
	const redirect = entryRedirect(request);
	if (redirect) return redirect;
	return NextResponse.next({
		headers: {
			"x-searchParams": request.nextUrl.searchParams.toString(),
			"x-pathname": request.nextUrl.pathname,
		},
	});
};

export const proxy = isLocalDevelopment
	? searchParamsMiddleware
	: clerkMiddleware(async (_, req) => {
			return searchParamsMiddleware(req);
		});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
