import { useForm } from "@tanstack/react-form";
import z from "zod/v4";

const eventResponseFromSchema = z.object({
	satisfaction: z.int().min(1).max(5),
	impression: z.int().min(1).max(5),
	expectation: z.int().min(1).max(5),
	toughts: z.string().min(1).max(1000),
	improvements: z.string().min(1).max(1000),
	want_to_work: z.boolean(),
	word_of_mouth: z.string().min(1).max(200),
	other: z.string().min(1).max(1000),
});

export default function EventResponse() {
	const company = "bedrift";

	return (
		<>
			<div>
				<h1>Bedriftspresentasjon med {company}</h1>
			</div>

			<div></div>
		</>
	);
}

export function EventResponseFrom() {
	const form = useForm({
		defaultValues: {},
		validators: {
			onSubmit: eventResponseFromSchema,
		},
		onSubmit: async ({ value }) => {
			console.log(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		></form>
	);
}
