import { expect, it, vi } from "vitest";
import { formSubmitOptions } from "./form-submit-actions";

it.each(["primary", "secondary", "tertiary"] as const)(
	"waits for the %s action before finishing the submission",
	async (submitAction) => {
		let finish!: () => void;
		const save = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const actions = {
			primary: vi.fn(() => save),
			secondary: vi.fn(() => save),
			tertiary: vi.fn(() => save),
		};
		const options = formSubmitOptions(actions);
		const value = { title: "Page" };
		let completed = false;
		const submission = Promise.resolve(options.onSubmit({ value, meta: { submitAction } })).then(
			() => {
				completed = true;
			},
		);
		await Promise.resolve();
		expect(completed).toBe(false);
		for (const [action, callback] of Object.entries(actions)) {
			expect(callback).toHaveBeenCalledTimes(action === submitAction ? 1 : 0);
		}
		expect(actions[submitAction]).toHaveBeenCalledWith(value);
		finish();
		await submission;
		expect(completed).toBe(true);
	},
);

it.each(["primary", "secondary", "tertiary"] as const)(
	"propagates errors from the %s action to the form",
	async (submitAction) => {
		const error = new Error("Save failed");
		const options = formSubmitOptions({ [submitAction]: () => Promise.reject(error) });
		await expect(options.onSubmit({ value: {}, meta: { submitAction } })).rejects.toBe(error);
	},
);
