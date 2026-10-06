"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import type { ComponentProps } from "react";

const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

function BoundInput({
	label,
	id,
	...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur"> & { label: string }) {
	const field = useFieldContext<string | number>();
	const inputId = id ?? field.name;
	return (
		<Field>
			<FieldLabel htmlFor={inputId}>{label}</FieldLabel>
			<Input
				{...props}
				id={inputId}
				value={field.state.value}
				onBlur={field.handleBlur}
				onChange={(event) =>
					field.handleChange(
						props.type === "number" ? Number(event.target.value) : event.target.value,
					)
				}
			/>
		</Field>
	);
}

export const { useAppForm } = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: { Input: BoundInput },
	formComponents: {},
});
