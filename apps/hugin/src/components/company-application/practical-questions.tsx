import {
	ESCAPE_ANSWERS,
	ESCAPE_LABELS,
	FOOD_PURCHASER_LABELS,
	FOOD_PURCHASERS,
	VENUE_LABELS,
	VENUES,
} from "@workspace/shared/semester/labels";
import { fieldErrorText, questionIds } from "@/components/input-cards/question-block";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { ApplicationQuestion, answerAria, FormSection } from "./application-question";
import { ChoiceGroup } from "./choice-group";
import type { ApplicationFormApi } from "./use-application-form";

const VENUE_OPTIONS = VENUES.map((value) => ({ value, label: VENUE_LABELS[value] }));
const ESCAPE_OPTIONS = ESCAPE_ANSWERS.map((value) => ({ value, label: ESCAPE_LABELS[value] }));
const FOOD_PURCHASER_OPTIONS = FOOD_PURCHASERS.map((value) => ({
	value,
	label: FOOD_PURCHASER_LABELS[value],
}));
const YES_NO = [
	{ value: "yes", label: COPY.yesNo.yes },
	{ value: "no", label: COPY.yesNo.no },
] as const;

function yesNo(value: boolean | null): "yes" | "no" | "" {
	return value === null ? "" : value ? "yes" : "no";
}

const PURCHASER_PROMPT_ID = "food-purchaser";

/** «Praktisk»: where, food and drinks, and Escape. */
export function PracticalQuestions({ form }: Readonly<{ form: ApplicationFormApi }>) {
	return (
		<>
			<FormSection>{COPY.sections.practical}</FormSection>

			<form.Field name="venue">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion name="venue" label={COPY.venue.label} error={error}>
							<ChoiceGroup
								name="venue"
								options={VENUE_OPTIONS}
								value={field.state.value}
								onChange={field.handleChange}
								invalid={Boolean(error)}
								labelledBy={questionIds("venue").promptId}
								describedBy={answerAria("venue", error)["aria-describedby"]}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			{/* One question with two answers: whether there is food, and then who buys it. */}
			<form.Field name="foodPurchasedBy">
				{(purchaser) => (
					<form.Field name="foodAndDrinks">
						{(food) => {
							const foodError = fieldErrorText(food);
							const purchaserError = fieldErrorText(purchaser);
							const error = foodError ?? purchaserError;
							return (
								<ApplicationQuestion name="foodAndDrinks" label={COPY.food.label} error={error}>
									<ChoiceGroup
										name="foodAndDrinks"
										layout="row"
										options={YES_NO}
										value={yesNo(food.state.value)}
										onChange={(next) => food.handleChange(next === "yes")}
										invalid={Boolean(foodError)}
										labelledBy={questionIds("foodAndDrinks").promptId}
										describedBy={answerAria("foodAndDrinks", error)["aria-describedby"]}
									/>
									{food.state.value && (
										<div className="mt-3.5">
											<p id={PURCHASER_PROMPT_ID} className="m-0 mb-2 font-semibold text-[14px]">
												{COPY.food.purchaser}
											</p>
											<ChoiceGroup
												name="foodPurchasedBy"
												options={FOOD_PURCHASER_OPTIONS}
												value={purchaser.state.value}
												onChange={purchaser.handleChange}
												invalid={Boolean(purchaserError)}
												labelledBy={PURCHASER_PROMPT_ID}
												describedBy={
													answerAria("foodAndDrinks", purchaserError)["aria-describedby"]
												}
											/>
										</div>
									)}
								</ApplicationQuestion>
							);
						}}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="wantsToUseEscape">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion
							name="wantsToUseEscape"
							label={COPY.escape.label}
							hint={COPY.escape.hint}
							error={error}
						>
							<ChoiceGroup
								name="wantsToUseEscape"
								layout="row"
								options={ESCAPE_OPTIONS}
								value={field.state.value}
								onChange={field.handleChange}
								invalid={Boolean(error)}
								labelledBy={questionIds("wantsToUseEscape").promptId}
								describedBy={
									answerAria("wantsToUseEscape", error, { hint: true })["aria-describedby"]
								}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>
		</>
	);
}
