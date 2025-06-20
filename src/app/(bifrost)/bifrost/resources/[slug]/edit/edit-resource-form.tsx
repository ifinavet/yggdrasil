"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/bifrost/resource-form/resource-form";
import type { ResourceSchemaValues } from "@/utils/bifrost/schemas/resource-form-schema";
import updateResource from "@/lib/queries/bifrost/resource/updateResource";
import getResource from "@/lib/queries/bifrost/resource/getResource";

export default function EditResourceForm({ id }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: resource } = useQuery({
    queryKey: ["resource", id],
    queryFn: () => getResource(id),
    enabled: !!id,
  });

  if (!resource) return null;

  const defaultValues: ResourceSchemaValues = {
    title: resource.title,
    content: resource.content,
    excerpt: resource.excerpt || "",
    tag: resource.tag || "",
  };

  const { mutate } = useMutation({
    mutationFn: ({
      values,
      published,
    }: {
      values: ResourceSchemaValues;
      published: boolean;
    }) => updateResource(id, values, published),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", id] });

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
    mutate({ values, published: resource.published });
  };

  const onSubmitAndUnpublish = () => {
    mutate({ values: defaultValues, published: false });
  };

  return (
    <ResourceForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={onSubmitAndPublish}
      onSecondarySubmitAction={onSubmitAndSave}
      onTertiarySubmitAction={onSubmitAndUnpublish}
    />
  );
}
