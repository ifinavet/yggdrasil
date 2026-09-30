import { useForm } from "@tanstack/react-form";
import { useQuery } from "convex/react";
import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement, useTransition } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type FormSubmitActions from "@/components/common/forms/form-submit-actions";
import JobListingForm from "./job-listing-form";

vi.mock("convex/react", () => ({ useQuery: vi.fn(() => ({ jobTypes: ["Trainee"] })) }));
vi.mock("react", async (original) => ({
	...(await original<typeof import("react")>()),
	useRef: vi.fn((value) => ({ current: value })),
	useTransition: vi.fn(() => [false, (action: () => Promise<void>) => action()]),
}));
vi.mock("@tanstack/react-form", () => ({ useForm: vi.fn() }));
vi.mock("@/components/common/forms/markdown-editor/editor", () => ({ default: () => null }));
vi.mock("@/components/common/forms/company-select-field", () => ({ default: () => null }));
vi.mock("@/components/common/forms/date-time-picker", () => ({ default: () => null }));

const values = {
	title: "",
	teaser: "",
	description: "",
	deadline: new Date("2030-01-01"),
	type: "Legacy",
	company: { name: "", id: "" },
	contacts: [],
	applicationUrl: "",
};
const submit = vi.fn();
const remove = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useForm).mockReturnValue({
		Field: () => null,
		Subscribe: () => null,
		state: { isSubmitting: false, values },
		handleSubmit: submit,
	} as never);
});

function actions() {
	const element = JobListingForm({
		defaultValues: values,
		latestDeadline: new Date("2027-01-01"),
		onPrimarySubmitAction: vi.fn(),
		onSecondarySubmitAction: vi.fn(),
		onTertiarySubmitAction: remove,
	});
	const form = vi.mocked(useForm).mock.results.at(-1)?.value;
	const subscription = (element.props.children as ReactElement[]).find(
		(child) => child.type === form.Subscribe,
	) as ReactElement<{
		selector: (state: { isSubmitting: boolean }) => boolean;
		children: (isSubmitting: boolean) => ReactElement<Parameters<typeof FormSubmitActions>[0]>;
	}>;
	return subscription.props.children(subscription.props.selector(form.state));
}

it("deletes a listing with invalid fields without submitting or validating the form", async () => {
	actions().props.onSubmitAction("tertiary");
	expect(remove).toHaveBeenCalledWith(values);
	expect(submit).not.toHaveBeenCalled();
	const transition = vi.mocked(useTransition).mock.results[0]?.value[1];
	expect(transition).toBeTypeOf("function");
});

it.each(["primary", "secondary"] as const)("still validates %s saves", (action) => {
	actions().props.onSubmitAction(action);
	expect(submit).toHaveBeenCalledWith({ submitAction: action });
	expect(remove).not.toHaveBeenCalled();
	expect(useQuery).toHaveBeenCalled();
});

it("allows unpublishing an overlong legacy deadline but still blocks publishing it", () => {
	const buttons = actions();
	const validator = vi.mocked(useForm).mock.calls[0]?.[0]?.validators?.onSubmit;
	const formApi = {
		parseValuesWithSchema: (schema: { safeParse: (value: unknown) => { success: boolean } }) =>
			schema.safeParse({
				...values,
				title: "Jobb",
				teaser: "Hei",
				description: "Jobb",
				contacts: [{ name: "Navn" }],
			}).success,
	};
	if (typeof validator !== "function") throw new Error("Expected submit validator");
	buttons.props.onSubmitAction("primary");
	expect(validator({ formApi } as never)).toBe(false);
	buttons.props.onSubmitAction("secondary");
	expect(validator({ formApi } as never)).toBe(true);
});

it("disables form actions while deletion is pending", () => {
	vi.mocked(useTransition).mockReturnValueOnce([true, vi.fn()]);
	expect(actions().props.isSubmitting).toBe(true);
});

function descendants(node: ReactNode): ReactElement<Record<string, unknown>>[] {
	return Children.toArray(node).flatMap((child) => {
		if (!isValidElement<Record<string, unknown>>(child)) return [];
		return [child, ...descendants(child.props.children as ReactNode)];
	});
}

it.each([["Trainee"], ["Trainee", "Legacy"]])(
	"offers configured and legacy job types (%j)",
	(...jobTypes) => {
		vi.mocked(useQuery).mockReturnValueOnce({ jobTypes });
		const element = JobListingForm({
			defaultValues: values,
			latestDeadline: new Date("2027-01-01"),
			onPrimarySubmitAction: vi.fn(),
			onSecondarySubmitAction: vi.fn(),
		});
		const typeField = descendants(element).find((node) => node.props.name === "type");
		const renderField = typeField?.props.children as (field: unknown) => ReactNode;
		const options = descendants(
			renderField({
				state: { value: "Legacy", meta: { isTouched: false, isValid: true } },
				handleChange: vi.fn(),
			}),
		).filter((node) => node.props.textValue);
		expect(options.map((node) => node.props.value)).toEqual(["Trainee", "Legacy"]);
	},
);

it("disables actions through the subscription while saving", () => {
	const form = vi.mocked(useForm).mock.results;
	const buttons = actions();
	expect(buttons.props.isSubmitting).toBe(false);
	const current = form.at(-1)?.value;
	if (!current) throw new Error("Expected form");
	current.state.isSubmitting = true;
	expect(actions().props.isSubmitting).toBe(true);
});

it("rejects deletion if a save started after the actions rendered", () => {
	const buttons = actions();
	const current = vi.mocked(useForm).mock.results.at(-1)?.value;
	if (!current) throw new Error("Expected form");
	current.state.isSubmitting = true;
	buttons.props.onSubmitAction("tertiary");
	expect(remove).not.toHaveBeenCalled();
});
