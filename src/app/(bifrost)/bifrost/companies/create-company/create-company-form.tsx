"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CompanyForm from "@/components/bifrost/companies-form/company-form";
import createCompany from "@/lib/queries/bifrost/company/createCompany";
import type { CompanyFormValues } from "@/utils/bifrost/schemas/companies-form-schema";

export default function CreateCompanyForm() {
  const defautlValues: CompanyFormValues = {
    company_name: "",
    description: "",
    org_number: "",
    company_image: "",
  };

  const router = useRouter();

  const { mutate } = useMutation({
    mutationFn: (values: CompanyFormValues) => createCompany(values),
    onSuccess: () => {
      toast.success("Bedriften ble lagt til!", {
        description: `Bedrift opprettet, ${new Date().toLocaleDateString()}`,
      });
      router.push("/bifrost/companies");
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

  return (
    <CompanyForm
      defaultValues={defautlValues}
      onPrimarySubmitAction={handleSubmit}
    />
  );
}
