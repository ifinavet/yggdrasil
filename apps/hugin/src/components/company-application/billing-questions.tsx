import { MIDGARD_URL } from "@workspace/shared/constants";
import { CheckboxLine, linkClass } from "@/components/form-controls";
import { fieldErrorText, questionIds } from "@/components/input-cards/question-block";
import { questionNumber, TEXT_LIMITS } from "@/lib/company-application";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FieldLabel,
	FormSection,
	LongTextAnswer,
	TextAnswer,
} from "./application-question";
import type { ApplicationFormApi } from "./use-application-form";

/** «Faktura»: how Navet invoices the company, anything else, and the consent. */
export function BillingQuestions({
	form,
	termsUrl,
}: Readonly<{ form: ApplicationFormApi; termsUrl?: string }>) {
	return (
		<>
			<FormSection>{COPY.sections.billing}</FormSection>

			<form.Field name="billing">
				{(field) => {
					const error = fieldErrorText(field);
					const billing = field.state.value;
					const aria = answerAria("billing", error);
					return (
						<ApplicationQuestion name="billing" label={COPY.billing.label} error={error}>
							<div className="grid gap-3">
								<FieldLabel htmlFor="billing-email" label={COPY.billing.emailLabel}>
									<TextAnswer
										id="billing-email"
										type="email"
										inputMode="email"
										value={billing.email}
										onValueChange={(email) => field.handleChange({ ...billing, email })}
										invalid={Boolean(error)}
										autoComplete="email"
										{...aria}
									/>
								</FieldLabel>
								<FieldLabel htmlFor="billing-details" label={COPY.billing.detailsLabel}>
									<LongTextAnswer
										id="billing-details"
										value={billing.details}
										onValueChange={(details) => field.handleChange({ ...billing, details })}
										invalid={Boolean(error)}
										maxLength={TEXT_LIMITS.billingDetails}
										rows={2}
										className="min-h-[72px]"
										{...aria}
									/>
								</FieldLabel>
								<CheckboxLine
									id="billing-ehf"
									checked={billing.ehfInvoice}
									onChange={(ehfInvoice) => field.handleChange({ ...billing, ehfInvoice })}
								>
									<label htmlFor="billing-ehf" className="cursor-pointer">
										{COPY.billing.ehfLabel}
									</label>
								</CheckboxLine>
							</div>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="additionalInfo">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<ApplicationQuestion
							name="additionalInfo"
							label={COPY.additionalInfo.label}
							labelFor="additionalInfo"
							error={error}
						>
							<LongTextAnswer
								id="additionalInfo"
								value={field.state.value}
								onValueChange={field.handleChange}
								invalid={Boolean(error)}
								maxLength={TEXT_LIMITS.additionalInfo}
								rows={3}
								{...answerAria("additionalInfo", error)}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="consent">
				{(field) => (
					<div data-question="consent" className="mt-[22px] scroll-mt-[56px]">
						<CheckboxLine
							id="consent"
							required
							checked={field.state.value}
							onChange={field.handleChange}
							error={fieldErrorText(field)}
							errorId={questionIds("consent").errorId}
						>
							<label htmlFor="consent" className="cursor-pointer">
								{questionNumber("consent")}. {COPY.consent.label}
							</label>{" "}
							<a
								href={`${MIDGARD_URL}/info/personvernerklaering`}
								target="_blank"
								rel="noreferrer"
								className={linkClass}
							>
								{COPY.consent.privacy}
							</a>
							{termsUrl && (
								<>
									{" "}
									<a href={termsUrl} target="_blank" rel="noreferrer" className={linkClass}>
										{COPY.consent.terms}
									</a>
								</>
							)}
						</CheckboxLine>
					</div>
				)}
			</form.Field>
		</>
	);
}
