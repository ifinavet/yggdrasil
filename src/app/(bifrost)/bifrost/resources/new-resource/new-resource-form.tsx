"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/bifrost/resource-form/resource-form";
import createResource from "@/lib/queries/bifrost/resource/createResource";
import type { ResourceSchemaValues } from "@/utils/bifrost/schemas/resource-form-schema";

export default function NewResourceForm() {
  const router = useRouter();

  const defaultValues: ResourceSchemaValues = {
    title: "",
    content: "",
    excerpt: "",
    tag: "",
  };

  const { mutate } = useMutation({
    mutationFn: ({
      values,
      published,
    }: {
      values: ResourceSchemaValues;
      published: boolean;
    }) => createResource(values, published),
    onSuccess: () => {
      toast.success("Ressurs opprettet!", {
        description: `Ressurs opprettet, ${new Date().toLocaleDateString()}`,
      });
      router.push("/bifrost/resources");
    },
    onError: (error) => {
      console.error(error);
      console.error("Noe gikk galt!");
      toast.error("Noe gikk galt!", {
        description: error.message,
      });
    },
  });

  const onSubmitAndPublish = (values: ResourceSchemaValues) => {
    mutate({ values, published: true });
  };

  const onSubmitAndSave = (values: ResourceSchemaValues) => {
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
