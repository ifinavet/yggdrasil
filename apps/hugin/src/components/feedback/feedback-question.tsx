import type { AnyFieldApi } from "@tanstack/react-form";
import type { FeedbackField } from "@workspace/shared/feedback";
import {
	BooleanCard,
	MultipleOptionsCard,
	RatingCard,
	TextInputCard,
} from "@/components/input-cards";
import { feedbackCopy } from "@/lib/feedback/copy";

export function FeedbackQuestion({
	field,
	question,
	number,
}: {
	readonly field: AnyFieldApi;
	readonly question: FeedbackField;
	readonly number: number;
}) {
	const label = question.required ? question.label : `${question.label} (${feedbackCopy.optional})`;
	const props = { field, number, label };
	switch (question.type) {
		case "rating":
			return (
				<RatingCard
					{...props}
					required={question.required}
					low={question.low ?? ""}
					high={question.high ?? ""}
				/>
			);
		case "yesNo":
			return <BooleanCard {...props} required={question.required} />;
		case "text":
			return (
				<TextInputCard
					{...props}
					required={question.required}
					placeholder={question.placeholder ?? ""}
				/>
			);
		case "options":
			return (
				<MultipleOptionsCard
					{...props}
					options={question.options ?? []}
					allowOther={question.allowOther ?? false}
				/>
			);
	}
}
