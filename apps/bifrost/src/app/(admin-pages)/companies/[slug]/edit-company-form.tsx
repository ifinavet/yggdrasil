"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import CompanyForm from "@/components/companies/companies-form/company-form";
import { notifyCompanyMutation } from "@/components/companies/companies-form/company-mutation-feedback";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";

export default function EditCompanyForm({
	company_id,
}: Readonly<{
	readonly company_id: Id<"companies">;
}>) {
	const company = useQuery(api.companies.queries.getById, { id: company_id });

	const router = useRouter();

	const updateCompany = useMutation(api.companies.mutations.update);
	const handleSubmit = (values: CompanyFormValues) =>
		notifyCompanyMutation(
			updateCompany({
				id: company_id,
				orgNumber: Number.parseInt(values.orgNumber, 10),
				name: values.name,
				description: values.description,
				logo: values.image as Id<"companyLogos">,
			}),
			"Bedriften ble oppdatert!",
			"Bedrift oppdatert",
			router,
		);

	const deleteCompany = useMutation(api.companies.mutations.remove);
	const handleDelete = () =>
		notifyCompanyMutation(
			deleteCompany({ id: company_id }),
			"Bediften ble slettet suksessfullt!",
			"Bedrift slettet",
			router,
		);

	if (!company) {
		return <div>Loading...</div>;
	}

	const defaultValues: CompanyFormValues = {
		name: company.name,
		description: company.description,
		orgNumber: company.orgNumber.toString(),
		image: company.logo as Id<"companyLogos">,
	};

	return (
		<CompanyForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={handleSubmit}
			onSecondarySubmitAction={handleDelete}
		/>
	);
}
