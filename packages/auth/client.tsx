"use client";

import {
	ClerkProvider,
	SignOutButton as ClerkSignOutButton,
	useAuth,
	useUser,
} from "@clerk/nextjs";
import { DEV_USERS, type DevUser } from "@workspace/shared/constants";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { isMockAuth } from "./mode";

export { isMockAuth };

export type ClientAuthUser = {
	readonly externalId: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly email: string;
	readonly username: string | null;
	readonly imageUrl: string;
};

export type AuthState = {
	readonly isLoading: boolean;
	readonly isSignedIn: boolean;
	readonly user: ClientAuthUser | null;
};

let sessionRequest: Promise<ClientAuthUser | null> | null = null;

function fetchDevSession(): Promise<ClientAuthUser | null> {
	if (!sessionRequest) {
		sessionRequest = fetch("/api/dev-auth/session")
			.then((response) => {
				if (!response.ok) throw new Error(`Development session request failed: ${response.status}`);
				return response.json();
			})
			.then((data: { user: DevUser | null }) =>
				data.user
					? {
							externalId: data.user.externalId,
							firstName: data.user.firstName,
							lastName: data.user.lastName,
							email: data.user.email,
							username: null,
							imageUrl: "",
						}
					: null,
			)
			.catch((error) => {
				sessionRequest = null;
				console.error("Could not read the development session", error);
				return null;
			});
	}

	return sessionRequest;
}

function useMockAuthUser(): AuthState {
	const [state, setState] = useState<AuthState>({
		isLoading: true,
		isSignedIn: false,
		user: null,
	});

	useEffect(() => {
		let cancelled = false;

		fetchDevSession().then((user) => {
			if (cancelled) return;
			setState({ isLoading: false, isSignedIn: user !== null, user });
		});

		return () => {
			cancelled = true;
		};
	}, []);

	return state;
}

function useClerkAuthUser(): AuthState {
	const { isLoaded, isSignedIn, user } = useUser();

	return useMemo(
		() => ({
			isLoading: !isLoaded,
			isSignedIn: Boolean(isSignedIn),
			user:
				isSignedIn && user
					? {
							externalId: user.id,
							firstName: user.firstName ?? "",
							lastName: user.lastName ?? "",
							email: user.primaryEmailAddress?.emailAddress ?? "",
							username: user.username,
							imageUrl: user.imageUrl,
						}
					: null,
		}),
		[isLoaded, isSignedIn, user],
	);
}

export const useAuthUser: () => AuthState = isMockAuth ? useMockAuthUser : useClerkAuthUser;

function useMockConvexAuth() {
	const { isLoading, isSignedIn } = useMockAuthUser();

	const fetchAccessToken = useCallback(async () => {
		try {
			const response = await fetch("/api/dev-auth/token");
			if (!response.ok) return null;

			const { token } = (await response.json()) as { token: string };
			return token;
		} catch (error) {
			console.error("Could not mint a development token", error);
			return null;
		}
	}, []);

	return useMemo(
		() => ({ isLoading, isAuthenticated: isSignedIn, fetchAccessToken }),
		[isLoading, isSignedIn, fetchAccessToken],
	);
}

export async function signInAsDevUser(externalId: string): Promise<void> {
	const response = await fetch("/api/dev-auth/sign-in", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ externalId }),
	});

	if (!response.ok) {
		throw new Error("Could not sign in as the selected development user");
	}

	window.location.reload();
}

export async function signOutOfDevSession(): Promise<void> {
	await fetch("/api/dev-auth/sign-out", { method: "POST" });
	window.location.reload();
}

export function SignOutButton({
	children,
	...props
}: Readonly<{ children: ReactNode } & Record<string, unknown>>) {
	if (!isMockAuth) {
		return <ClerkSignOutButton {...props}>{children}</ClerkSignOutButton>;
	}

	const signOut = () => void signOutOfDevSession();

	if (isValidElement(children)) {
		return cloneElement(children as ReactElement<Record<string, unknown>>, {
			...props,
			onClick: signOut,
		});
	}

	return (
		<button type="button" {...props} onClick={signOut}>
			{children}
		</button>
	);
}

export function DevSignIn() {
	const [error, setError] = useState<string | null>(null);

	return (
		<div className="mx-auto w-full max-w-md rounded-lg border p-6">
			<h1 className="mb-1 font-bold text-2xl">Logg inn lokalt</h1>
			<p className="mb-6 text-muted-foreground text-sm">
				Utviklingsmodus uten Clerk. Velg en av brukerne fra seed-dataene.
			</p>

			<ul className="flex flex-col gap-2">
				{DEV_USERS.map((user) => (
					<li key={user.externalId}>
						<button
							className="w-full rounded-md border px-4 py-3 text-left hover:bg-muted"
							type="button"
							onClick={() => {
								signInAsDevUser(user.externalId).catch(() =>
									setError(
										"Klarte ikke å logge inn. Kjører appen med NEXT_PUBLIC_AUTH_PROVIDER=mock?",
									),
								);
							}}
						>
							<span className="block font-medium">
								{user.firstName} {user.lastName}
							</span>
							<span className="block text-muted-foreground text-sm">
								{user.role ?? "student"} · {user.email}
							</span>
						</button>
					</li>
				))}
			</ul>

			{error && <p className="mt-4 text-destructive text-sm">{error}</p>}
		</div>
	);
}

export function AuthProvider({
	children,
	...clerkProps
}: Readonly<{ children: ReactNode } & Record<string, unknown>>) {
	if (isMockAuth) return <>{children}</>;

	return <ClerkProvider {...clerkProps}>{children}</ClerkProvider>;
}

export function ConvexAuthProvider({
	client,
	children,
}: Readonly<{ client: ConvexReactClient; children: ReactNode }>) {
	if (isMockAuth) {
		return (
			<ConvexProviderWithAuth client={client} useAuth={useMockConvexAuth}>
				{children}
			</ConvexProviderWithAuth>
		);
	}

	return (
		<ConvexProviderWithClerk client={client} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
