// Moves a form's attention to one question after a failed send: scroll it into view, then focus
// its first control once the smooth scroll has settled.

const CONTROL_SELECTOR =
	'button[role="radio"], button[role="checkbox"], textarea, input:not([tabindex="-1"]), button';
const SCROLL_SETTLE_MS = 400;

/** Scrolls to the question marked `data-question={name}` and focuses its first control. */
export function focusQuestion(form: HTMLElement | null, name: string): void {
	const block = form?.querySelector<HTMLElement>(`[data-question="${name}"]`);
	block?.scrollIntoView({ block: "center", behavior: "smooth" });
	window.setTimeout(() => {
		block?.querySelector<HTMLElement>(CONTROL_SELECTOR)?.focus({ preventScroll: true });
	}, SCROLL_SETTLE_MS);
}
