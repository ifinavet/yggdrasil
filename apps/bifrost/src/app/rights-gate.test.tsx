import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RightsGate } from "./rights-gate";

const redirect = vi.hoisted(() =>
	vi.fn((path: string) => {
		throw new Error(`REDIRECT:${path}`);
	}),
);

vi.mock("next/navigation", () => ({ redirect }));

async function render(hasRights: () => Promise<boolean>) {
	const errors: string[] = [];
	const stream = await renderToReadableStream(
		<RightsGate hasRights={hasRights}>
			<p>protected content</p>
		</RightsGate>,
		{ onError: (error) => void errors.push(String(error)) },
	);
	await stream.allReady;
	const html = await new Response(stream).text();
	return { html, errors };
}

describe("RightsGate", () => {
	it("renders children when the user has rights", async () => {
		const { html, errors } = await render(async () => true);

		expect(html).toContain("protected content");
		expect(errors).toEqual([]);
	});

	it("redirects to the home page and renders no children when the user lacks rights", async () => {
		const { html, errors } = await render(async () => false);

		expect(redirect).toHaveBeenCalledWith("/");
		expect(errors.some((error) => error.includes("REDIRECT:/"))).toBe(true);
		expect(html).not.toContain("protected content");
	});
});
