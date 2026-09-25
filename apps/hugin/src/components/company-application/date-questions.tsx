import { Note } from "@workspace/ui/components/note";
import { fieldErrorText, questionIds } from "@/components/input-cards/question-block";
import { TEXT_LIMITS } from "@/lib/company-application";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FormSection,
	LongTextAnswer,
} from "./application-question";
import { DateGrid } from "./date-grid";
import type { ApplicationFormApi } from "./use-application-form";

/** «Datoer»: the open dates that suit the company, and any wishes about them. */
export function DateQuestions({
	form,
	dates,
}: Readonly<{ form: ApplicationFormApi; dates: readonly string[] }>) {
	return (
		<>
			<FormSection>{COPY.sections.dates}</FormSection>

			<form.Field name="availableDates">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion name="availableDates" label={COPY.dates.label} error={error}>
							{dates.length === 0 ? (
								<Note tone="warn">{COPY.dates.none}</Note>
							) : (
								<DateGrid
									dates={dates}
									value={field.state.value}
									onChange={field.handleChange}
									invalid={Boolean(error)}
									labelledBy={questionIds("availableDates").promptId}
									describedBy={answerAria("availableDates", error)["aria-describedby"]}
								/>
							)}
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="datePreferences">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion
							name="datePreferences"
							label={COPY.datePreferences.label}
							labelFor="datePreferences"
							error={error}
						>
							<LongTextAnswer
								id="datePreferences"
								value={field.state.value}
								onValueChange={field.handleChange}
								invalid={Boolean(error)}
								maxLength={TEXT_LIMITS.datePreferences}
								rows={2}
								className="min-h-[72px]"
								{...answerAria("datePreferences", error)}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>
		</>
	);
}
