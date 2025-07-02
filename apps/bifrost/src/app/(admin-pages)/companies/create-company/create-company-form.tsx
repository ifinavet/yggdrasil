"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CompanyForm from "@/components/companies/companies-form/company-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import { createCompany } from "@/lib/queries/companies";

export default function CreateCompanyForm() {
	const defaultValues: CompanyFormValues = {
		company_name: "",
		description: "",
		org_number: "",
		company_image: {
			id: "",
			name: "",
		},
	};

	const router = useRouter();

	const { mutate } = useMutation({
		mutationFn: (values: CompanyFormValues) => createCompany(values),
		onSuccess: () => {
			toast.success("Bedriften ble lagt til!", {
				description: `Bedrift opprettet, ${new Date().toLocaleDateString()}`,
			});
			router.push("/companies");
		},
		onError: (error) => {
			console.error(error);
			console.error("Noe gikk galt!");
			toast.error("Noe gikk galt!", {
				description: error.message,
			});
		},
	});

	const handleSubmit = (values: CompanyFormValues) => {
		console.log(values);
		mutate(values);
	};

	return <CompanyForm defaultValues={defaultValues} onPrimarySubmitAction={handleSubmit} />;
}
