import { useForm } from "@tanstack/react-form";
import { beforeEach, expect, it, vi } from "vitest";
import CompanyForm from "./company-form";

vi.mock("@tanstack/react-form", () => ({
	useForm: vi.fn(() => ({
		Field: () => null,
		Subscribe: () => null,
		state: { isSubmitting: false },
	})),
}));
vi.mock("@/components/common/forms/markdown-editor/editor", () => ({ default: () => null }));
vi.mock("./select-image", () => ({ default: () => null }));

const values = { name: "Navet", orgNumber: "123456789", description: "Test company", image: "" };

beforeEach(() => vi.clearAllMocks());

it.each(["primary", "secondary"] as const)(
	"keeps %s submission pending until the save completes",
	async (submitAction) => {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		const save = vi.fn(() => promise);
		CompanyForm({
			defaultValues: values,
			onPrimarySubmitAction: save,
			onSecondarySubmitAction: save,
		});
		const onSubmit = vi.mocked(useForm).mock.calls[0]?.[0]?.onSubmit;
		expect(onSubmit).toBeTypeOf("function");
		let completed = false;
		const submission = Promise.resolve(
			onSubmit?.({ value: values, meta: { submitAction } } as never),
		).then(() => {
			completed = true;
		});
		await Promise.resolve();
		expect(save).toHaveBeenCalledWith(values);
		expect(completed).toBe(false);
		resolve();
		await submission;
		expect(completed).toBe(true);
	},
);

it("propagates save failures to the form instead of losing the rejected promise", async () => {
	const error = new Error("Save failed");
	CompanyForm({ defaultValues: values, onPrimarySubmitAction: () => Promise.reject(error) });
	const onSubmit = vi.mocked(useForm).mock.calls[0]?.[0]?.onSubmit;
	await expect(
		onSubmit?.({ value: values, meta: { submitAction: "primary" } } as never),
	).rejects.toBe(error);
});
