"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CompanyForm from "@/components/companies/companies-form/company-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";

export default function CreateCompanyForm() {
  const defaultValues: CompanyFormValues = {
    name: "",
    description: "",
    orgNumber: "",
    image: "",
  };

  const router = useRouter();

  const createCompany = useMutation(api.companies.create);
  const handleSubmit = async (values: CompanyFormValues) => {
    createCompany({
      orgNumber: Number.parseInt(values.orgNumber),
      name: values.name,
      description: values.description,
      logo: values.image as Id<"companyLogos">,
    })
      .then(() => {
        toast.success("Bedriften ble lagt til!", {
          description: `Bedrift opprettet, ${new Date().toLocaleDateString()}`,
        });
        router.push("/companies");
      })
      .catch((error) => {
        console.error("Noe gikk galt!", error);
        toast.error("Noe gikk galt!", {
          description: error.message,
        });
      });
  };

  return <CompanyForm defaultValues={defaultValues} onPrimarySubmitAction={handleSubmit} />;
}
