"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CompanyForm from "@/components/companies/companies-form/company-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";

export default function EditCompanyForm({
	company_id,
}: {
	company_id: Id<"companies">;
}) {
	const company = useQuery(api.companies.getById, { id: company_id });

	const router = useRouter();

	const updateCompany = useMutation(api.companies.update);
	const handleSubmit = (values: CompanyFormValues) =>
		updateCompany({
			id: company_id,
			orgNumber: Number.parseInt(values.orgNumber),
			name: values.name,
			description: values.description,
			logo: values.image as Id<"companyLogos">,
		})
			.then(() => {
				toast.success("Bedriften ble oppdatert!", {
					description: `Bedrift oppdatert, ${new Date().toLocaleDateString()}`,
				});
				router.push("/companies");
			})
			.catch((error) => {
				console.error("Noe gikk galt!", error);
				toast.error("Noe gikk galt!", {
					description: error.message,
				});
			});

	const deleteCompany = useMutation(api.companies.remove);
	const handleDelete = () =>
		deleteCompany({ id: company_id })
			.then(() => {
				toast.success("Bediften ble slettet suksessfullt!", {
					description: `Bedrift slettet, ${new Date().toLocaleDateString()}`,
				});
				router.push("/companies");
			})
			.catch((error) => {
				console.error("Noe gikk galt!", error);
				toast.error("Noe gikk galt!", {
					description: error.message,
				});
			});

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
