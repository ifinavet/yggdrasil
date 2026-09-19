import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export type PositionGroupFormField = {
	readonly name: string;
	readonly state: {
		readonly value: string;
		readonly meta: {
			readonly isTouched: boolean;
			readonly isValid: boolean;
			readonly errors: Array<{ message?: string } | undefined>;
		};
	};
	handleChange: (value: string) => void;
	handleBlur: () => void;
};

export default function PositionGroupField({ field }: Readonly<{ field: PositionGroupFormField }>) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field>
			<FieldLabel htmlFor={field.name}>Gruppe</FieldLabel>
			<Input
				id={field.name}
				name={field.name}
				value={field.state.value}
				onChange={(event) => field.handleChange(event.target.value)}
				onBlur={field.handleBlur}
				aria-invalid={isInvalid}
				placeholder="f.eks. Webgruppen"
			/>
			<FieldDescription>Hva skal gruppen til vervet hete?</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
