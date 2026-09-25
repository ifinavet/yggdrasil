import { api } from "@workspace/backend/convex/api";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "@workspace/shared/semester/labels";
import { CharacterCount } from "@workspace/ui/components/character-count";
import { ChoiceGroup, type ChoiceOption } from "@workspace/ui/components/choice-group";
import { useQuery } from "convex/react";
import { fieldErrorText, questionIds } from "@/components/input-cards/question-block";
import { TEXT_LIMITS } from "@/lib/company-application";
import { eventTypeDescription } from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FormSection,
	LongTextAnswer,
	TextAnswer,
} from "./application-question";
import type { ApplicationFormApi } from "./use-application-form";

function eventTypeOptions(
	pricesOre: Partial<Record<EventType, number>>,
): ChoiceOption<EventType>[] {
	return EVENT_TYPES.map((type) => ({
		value: type,
		label: EVENT_TYPE_LABELS[type],
		description: eventTypeDescription(type, pricesOre[type]),
	}));
}

/** «Arrangementet»: the event type, the number of students and the description. */
export function EventQuestions({ form }: Readonly<{ form: ApplicationFormApi }>) {
	const pricesOre = useQuery(api.products.queries.eventTypePrices) ?? {};

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
								options={eventTypeOptions(pricesOre)}
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
