import { api } from "@workspace/backend/convex/api";
import { isValidOrgNumber } from "@workspace/shared/semester/orgNumber";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
	type CompanyOption,
	CompanyPicker,
	hitMeta,
	type PickedCompany,
} from "@/components/company-picker/company-picker";
import { fieldErrorText } from "@/components/input-cards/question-block";
import type { ChosenCompany } from "@/lib/company-application";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	ApplicationQuestion,
	answerAria,
	FieldLabel,
	FormSection,
	TextAnswer,
} from "./application-question";
import type { ApplicationFormApi } from "./use-application-form";

const NO_COMPANIES: readonly CompanyOption[] = [];

function chosenFrom(picked: PickedCompany): ChosenCompany {
	if (picked.kind === "existing") {
		return { orgNumber: String(picked.company.orgNumber), name: picked.company.name };
	}
	const { orgNumber, name, organizationForm, city } = picked.hit;
	return { orgNumber, name, organizationForm, ...(city ? { city } : {}) };
}

/** «Bedriften»: the company, its contact person and who fills in the form. */
export function CompanyQuestions({ form }: Readonly<{ form: ApplicationFormApi }>) {
	const all = useQuery(api.companies.queries.pickerOptions);
	// An application is matched to its company by organization number, so only those with a valid
	// one are listed. Any other company is found in Enhetsregisteret instead.
	const companies = useMemo(
		() => all?.filter((company) => isValidOrgNumber(String(company.orgNumber))) ?? NO_COMPANIES,
		[all],
	);

	return (
		<>
			<FormSection>{COPY.sections.company}</FormSection>

			<form.Field name="company">
				{(field) => {
					const error = fieldErrorText(field);
					const company = field.state.value;
					return (
						<ApplicationQuestion
							name="company"
							label={COPY.company.label}
							labelFor="company"
							error={error}
						>
							<CompanyPicker
								id="company"
								selectedName={company?.name ?? ""}
								selectedId={
									companies.find((option) => String(option.orgNumber) === company?.orgNumber)?._id
								}
								companies={companies}
								invalid={Boolean(error)}
								describedBy={answerAria("company", error)["aria-describedby"]}
								onChange={(picked) => field.handleChange(chosenFrom(picked))}
							/>
							{company && (
								<p className="m-0 mt-2 text-[13px] text-muted-foreground tabular-nums">
									{hitMeta(company)}
								</p>
							)}
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
