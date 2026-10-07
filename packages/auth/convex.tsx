"use client";

import { useAuth } from "@clerk/nextjs";
import * as Convex from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useSyncExternalStore } from "react";
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

const subscribeToNothing = () => () => {};

function useHydrated() {
	return useSyncExternalStore(
		subscribeToNothing,
		() => true,
		() => false,
	);
}

function HydratedAuthenticated({ children }: { children: ReactNode }) {
	return useHydrated() ? <Convex.Authenticated>{children}</Convex.Authenticated> : null;
}
function HydratedUnauthenticated({ children }: { children: ReactNode }) {
	return useHydrated() ? <Convex.Unauthenticated>{children}</Convex.Unauthenticated> : null;
}
function HydratedAuthLoading({ children }: { children: ReactNode }) {
	return useHydrated() ? <Convex.AuthLoading>{children}</Convex.AuthLoading> : children;
}

export const useConvexAuth = isLocalDevelopment ? useLocalAuth : Convex.useConvexAuth;
export const Authenticated = isLocalDevelopment ? LocalAuthenticated : HydratedAuthenticated;
export const Unauthenticated = isLocalDevelopment ? LocalHidden : HydratedUnauthenticated;
export const AuthLoading = isLocalDevelopment ? LocalHidden : HydratedAuthLoading;
