"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/resources/resource-form/resource-form";
import createResource from "@/lib/queries/resource/createResource";
import type { ResourceFormValues } from "@/utils/schemas/resource-form-schema";

export default function NewResourceForm() {
  const router = useRouter();

  const defaultValues: ResourceFormValues = {
    title: "",
    content: "",
    excerpt: "",
    tag: "",
  };

  const { mutate } = useMutation({
    mutationFn: ({ values, published }: { values: ResourceFormValues; published: boolean }) =>
      createResource(values, published),
    onSuccess: () => {
      toast.success("Ressurs opprettet!", {
        description: `Ressurs opprettet, ${new Date().toLocaleDateString()}`,
      });
      router.push("/resources");
    },
    onError: (error) => {
      console.error(error);
      console.error("Noe gikk galt!");
      toast.error("Noe gikk galt!", {
        description: error.message,
      });
    },
  });

  const onSubmitAndPublish = (values: ResourceFormValues) => {
    mutate({ values, published: true });
  };

  const onSubmitAndSave = (values: ResourceFormValues) => {
    mutate({ values, published: false });
  };

  return (
    <ResourceForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={onSubmitAndPublish}
      onSecondarySubmitAction={onSubmitAndSave}
    />
  );
}
