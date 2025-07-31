"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { Preloaded, useMutation, usePreloadedQuery, useQuery } from "convex/react";
import { api } from "@workspace/backend/convex/api";

export default function EditPageForm({ preloadedPage }: { preloadedPage: Preloaded<typeof api.externalPages.getById> }) {
  const router = useRouter();

  const page = usePreloadedQuery(preloadedPage)


  const defaultValues: PageFormValues = {
    title: page.title,
    content: page.content,
  };

  const updatePage = useMutation(api.externalPages.update)
  const hanldeUpdatePage = async (values: PageFormValues, published: boolean) => {
    updatePage({
      id: page._id,
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
