import { fieldErrorText } from "@/components/input-cards/question-block";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FieldLabel,
	FormSection,
	TextAnswer,
} from "./application-question";
import { CompanySearch } from "./company-search";
import type { ApplicationFormApi } from "./use-application-form";

/** «Bedriften»: the company, its contact person and who fills in the form. */
export function CompanyQuestions({ form }: Readonly<{ form: ApplicationFormApi }>) {
	return (
		<>
			<FormSection>{COPY.sections.company}</FormSection>

			<form.Field name="company">
				{(field) => {
					const error = fieldErrorText(field);
					const company = field.state.value;
					return (
						<ApplicationQuestion name="company" label={COPY.company.label} error={error}>
							<CompanySearch
								company={company}
								onChange={field.handleChange}
								invalid={Boolean(error)}
								describedBy={answerAria("company", error)["aria-describedby"]}
							/>
						</ApplicationQuestion>
					);
				}}
			</form.Field>

			<form.Field name="contact">
				{(field) => {
					const error = fieldErrorText(field);
					const contact = field.state.value;
					const aria = answerAria("contact", error);
					return (
						<ApplicationQuestion name="contact" label={COPY.contact.label} error={error}>
							<div className="grid gap-3">
								<FieldLabel htmlFor="contact-name" label={COPY.contact.name}>
									<TextAnswer
										id="contact-name"
										value={contact.name}
										onValueChange={(name) => field.handleChange({ ...contact, name })}
										invalid={Boolean(error)}
										autoComplete="name"
										{...aria}
									/>
								</FieldLabel>
								<FieldLabel htmlFor="contact-email" label={COPY.contact.email}>
									<TextAnswer
										id="contact-email"
										type="email"
										inputMode="email"
										value={contact.email}
										onValueChange={(email) => field.handleChange({ ...contact, email })}
										invalid={Boolean(error)}
										autoComplete="email"
										{...aria}
									/>
								</FieldLabel>
								<FieldLabel htmlFor="contact-phone" label={COPY.contact.phone}>
									<TextAnswer
										id="contact-phone"
										type="tel"
										inputMode="tel"
										value={contact.phone}
										onValueChange={(phone) => field.handleChange({ ...contact, phone })}
										invalid={Boolean(error)}
										autoComplete="tel"
										{...aria}
									/>
								</FieldLabel>
							</div>
						</ApplicationQuestion>
					);
				}}
			</form.Field>
		</>
	);
}
