"use client";

import { useAuth } from "@clerk/nextjs";
import * as Convex from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { isLocalDevelopment } from "./local";

export default function ConvexProvider({
	client,
	children,
}: {
	client: Convex.ConvexReactClient;
	children: ReactNode;
}) {
	return isLocalDevelopment ? (
		<Convex.ConvexProvider client={client}>{children}</Convex.ConvexProvider>
	) : (
		<ConvexProviderWithClerk client={client} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}

function useLocalAuth() {
	return { isLoading: false, isAuthenticated: true };
}
function LocalAuthenticated({ children }: { children: ReactNode }) {
	return children;
}
function LocalHidden(_props: { children: ReactNode }) {
	return null;
}

export const useConvexAuth = isLocalDevelopment ? useLocalAuth : Convex.useConvexAuth;
export const Authenticated = isLocalDevelopment ? LocalAuthenticated : Convex.Authenticated;
export const Unauthenticated = isLocalDevelopment ? LocalHidden : Convex.Unauthenticated;
export const AuthLoading = isLocalDevelopment ? LocalHidden : Convex.AuthLoading;
