"use client";

import { ConvexAuthProvider } from "@workspace/auth/client";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
	throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file");
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function ConvexClientProvider({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
