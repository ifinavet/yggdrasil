"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import CompanyForm from "@/components/companies/companies-form/company-form";
import { notifyCompanyMutation } from "@/components/companies/companies-form/company-mutation-feedback";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";

export default function CreateCompanyForm() {
	const defaultValues: CompanyFormValues = {
		name: "",
		description: "",
		orgNumber: "",
		image: "",
	};

	const router = useRouter();

	const createCompany = useMutation(api.companies.mutations.create);
	const handleSubmit = async (values: CompanyFormValues) => {
		await notifyCompanyMutation(
			createCompany({
				orgNumber: Number.parseInt(values.orgNumber, 10),
				name: values.name,
				description: values.description,
				logo: values.image as Id<"companyLogos">,
			}),
			"Bedriften ble lagt til!",
			"Bedrift opprettet",
			router,
		);
	};

	return <CompanyForm defaultValues={defaultValues} onPrimarySubmitAction={handleSubmit} />;
}
