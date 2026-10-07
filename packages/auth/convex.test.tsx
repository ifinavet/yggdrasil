import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { Authenticated, AuthLoading, Unauthenticated } from "./convex";

const client = new ConvexReactClient("https://example.convex.cloud", {
	skipConvexDeploymentUrlCheck: true,
	unsavedChangesWarning: false,
});

const settledAnonymousAuth = () => ({
	isLoading: false,
	isAuthenticated: false,
	fetchAccessToken: async () => null,
});

function render(children: ReactNode) {
	return renderToString(
		<ConvexProviderWithAuth client={client} useAuth={settledAnonymousAuth}>
			{children}
		</ConvexProviderWithAuth>,
	);
}

describe("auth gates", () => {
	afterAll(() => client.close());

	it("renders the loading branch before hydration even when auth has already settled", () => {
		expect(
			render(
				<>
					<AuthLoading>
						<span>loading</span>
					</AuthLoading>
					<Authenticated>
						<span>profile</span>
					</Authenticated>
					<Unauthenticated>
						<span>sign in</span>
					</Unauthenticated>
				</>,
			),
		).toBe("<span>loading</span>");
	});
});
