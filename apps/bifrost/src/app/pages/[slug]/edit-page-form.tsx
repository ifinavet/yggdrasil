"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";

export default function EditPageForm({ id }: { id: string }) {
  const router = useRouter();

  const page = useQuery(api.externalPages.getById, { id: id as Id<"externalPages"> })

  if (!page) return null;

  const defaultValues: PageFormValues = {
    title: page.title,
    content: page.content,
  };

  const updatePage = useMutation(api.externalPages.update)
  const hanldeUpdatePage = async (values: PageFormValues, published: boolean) => {
    updatePage({
      id: id as Id<"externalPages">,
      title: values.title,
      content: values.content,
      published: published,
    }).then(() => {
      toast.success("Siden ble oppdatert!", {
        description: `Side oppdatert, ${new Date().toLocaleDateString()}`,
      });
      router.push("/pages");
    }).catch(error => {
      console.error(error);
      console.error("Noe gikk galt!");
      toast.error("Noe gikk galt!", {
        description: error.message,
      });
    })
  }

  const onSubmitAndPublish = (values: PageFormValues) => hanldeUpdatePage(values, true)

  const onSubmitAndSave = (values: PageFormValues) => hanldeUpdatePage(values, page.published)

  const onSubmitAndUnpublish = () => hanldeUpdatePage(defaultValues, false);

  return (
    <PageForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={onSubmitAndPublish}
      onSecondarySubmitAction={onSubmitAndSave}
      onTertiarySubmitAction={onSubmitAndUnpublish}
    />
  );
}
