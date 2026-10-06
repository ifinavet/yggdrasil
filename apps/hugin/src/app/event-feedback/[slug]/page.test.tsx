import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import ClosedEventFeedbackPage from "./page";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLElement | undefined;

afterEach(() => {
	container?.remove();
});

it("tells the visitor the form is closed and links to the front page", async () => {
	container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => root.render(<ClosedEventFeedbackPage />));

	expect(container.textContent).toContain("Dette tilbakemeldingsskjemaet er stengt");
	expect(container.textContent).toContain("Nye lenker til tilbakemelding kommer på e-post");
	expect(container.textContent).not.toContain("—");
	expect(container.querySelector("a")?.getAttribute("href")).toBe("/");
	await act(async () => root.unmount());
});
