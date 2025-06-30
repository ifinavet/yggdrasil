"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { createPage } from "@/lib/queries/pages";

export default function NewPageForm() {
  const router = useRouter();

  const defaultValues: PageFormValues = {
    title: "",
    content: "",
  };

  const { mutate } = useMutation({
    mutationFn: ({ values, published }: { values: PageFormValues; published: boolean }) =>
      createPage(values, published),
    onSuccess: () => {
      toast.success("Siden har blitt opprettet!", {
        description: `Side opprettet, ${new Date().toLocaleDateString()}`,
      });
      router.push("/pages");
    },
    onError: (error) => {
      console.error(error);
      console.error("Noe gikk galt!");
      toast.error("Noe gikk galt!", {
        description: error.message,
      });
    },
  });

  const onSubmitAndPublish = (values: PageFormValues) => {
    mutate({ values, published: true });
  };

  const onSubmitAndSave = (values: PageFormValues) => {
    mutate({ values, published: false });
  };

  return (
    <PageForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={onSubmitAndPublish}
      onSecondarySubmitAction={onSubmitAndSave}
    />
  );
}
