"use client";

import CompanyForm from "@/components/companies/companies-form/company-form";
import { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import { deleteCompany, getCompanyById, getCompanyImageById, updateCompany } from "@/lib/queries/companies";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EditCompanyForm({ company_id }: { company_id: number }) {
  const { data: company_image, isLoading: isLoadingImage } = useQuery({
    queryKey: ["company_image", company_id],
    queryFn: () => getCompanyImageById(company_id),
  });

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["company", company_id],
    queryFn: () => getCompanyById(company_id),
  });

  const router = useRouter();

  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: (values: CompanyFormValues) => updateCompany(company_id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", company_id] });
      queryClient.invalidateQueries({ queryKey: ["company_image", company_id] });
      toast.success("Bedriften ble oppdatert!", {
        description: `Bedrift oppdatert, ${new Date().toLocaleDateString()}`,
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

  const { mutate: delete_company } = useMutation({
    mutationFn: () => deleteCompany(company_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", company_id] });
      queryClient.invalidateQueries({ queryKey: ["company_image", company_id] });
      toast.success("Bediften ble slettet suksessfullt!", {
        description: `Bedrift slettet, ${new Date().toLocaleDateString()}`,
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

  })

  const { mutate: delete_image } = useMutation({
    mutationFn: (values: CompanyFormValues) => updateCompany(company_id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", company_id] });
      queryClient.invalidateQueries({ queryKey: ["company_image", company_id] });
      toast.success("Bedriften ble oppdatert!", {
        description: `Bedrift oppdatert, ${new Date().toLocaleDateString()}`,
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

  })

  const handleSubmit = (values: CompanyFormValues) => {
    mutate(values);
  };

  const handleDelete = () => {
    delete_company();
  };

  if (isLoadingCompany || isLoadingImage) {
    return <div>Loading...</div>;
  }

  const defaultValues: CompanyFormValues = {
    company_name: company?.company_name || "",
    description: company?.description || "",
    org_number: company?.org_number || "",
    company_image: {
      id: company_image?.image_id || "",
      name: company_image?.name || "",
    },
  };


  return <CompanyForm defaultValues={defaultValues} onPrimarySubmitAction={handleSubmit} onSecondarySubmitAction={handleDelete} />;
}
