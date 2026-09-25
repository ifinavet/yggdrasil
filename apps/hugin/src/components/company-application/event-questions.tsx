import { STUDENT_CAP } from "@workspace/shared/semester/application";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@workspace/shared/semester/labels";
import { EVENT_TYPE_PRICES, formatNok } from "@workspace/shared/semester/prices";
import { CharacterCount } from "@workspace/ui/components/character-count";
import { ChoiceGroup, type ChoiceOption } from "@workspace/ui/components/choice-group";
import { fieldErrorText, questionIds } from "@/components/input-cards/question-block";
import { TEXT_LIMITS } from "@/lib/company-application";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FormSection,
	LongTextAnswer,
	TextAnswer,
} from "./application-question";
import type { ApplicationFormApi } from "./use-application-form";

const EVENT_TYPE_OPTIONS: ChoiceOption<(typeof EVENT_TYPES)[number]>[] = EVENT_TYPES.map((type) => {
	const cap = STUDENT_CAP[type];
	const price = EVENT_TYPE_PRICES[type];
	const size = cap === null ? COPY.eventType.uncapped : COPY.eventType.capped(cap);
	return {
		value: type,
		label: EVENT_TYPE_LABELS[type],
		description: price === undefined ? size : `${size} · ${COPY.eventType.price(formatNok(price))}`,
	};
});

/** «Arrangementet»: the event type, the number of students and the description. */
export function EventQuestions({ form }: Readonly<{ form: ApplicationFormApi }>) {
	return (
		<>
			<FormSection>{COPY.sections.event}</FormSection>

			<form.Field name="eventType">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion name="eventType" label={COPY.eventType.label} error={error}>
							<ChoiceGroup
								name="eventType"
								options={EVENT_TYPE_OPTIONS}
								value={field.state.value}
								onChange={field.handleChange}
								invalid={Boolean(error)}
								labelledBy={questionIds("eventType").promptId}
								describedBy={answerAria("eventType", error)["aria-describedby"]}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="students">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion
							name="students"
							label={COPY.students.label}
							labelFor="students"
							error={error}
						>
							<TextAnswer
								id="students"
								value={field.state.value}
								onValueChange={field.handleChange}
								invalid={Boolean(error)}
								{...answerAria("students", error)}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="description">
				{(field) => {
					const error = fieldErrorText(field);
					const aria = answerAria("description", error);
					return (
						<ApplicationQuestion
							name="description"
							label={COPY.description.label}
							labelFor="description"
							error={error}
						>
							<LongTextAnswer
								id="description"
								value={field.state.value}
								onValueChange={field.handleChange}
								invalid={Boolean(error)}
								maxLength={TEXT_LIMITS.description}
								rows={4}
								{...aria}
								aria-describedby={[aria["aria-describedby"], "description-count"]
									.filter(Boolean)
									.join(" ")}
							/>
							<CharacterCount
								id="description-count"
								length={field.state.value.length}
								max={TEXT_LIMITS.description}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>
		</>
	);
}
