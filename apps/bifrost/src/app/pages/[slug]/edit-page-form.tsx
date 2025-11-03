"use client";

import { api } from "@workspace/backend/convex/api";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";

export default function EditPageForm({
	preloadedPage,
}: Readonly<{
	preloadedPage: Preloaded<typeof api.externalPages.getById>;
}>) {
	const router = useRouter();

	const posthog = usePostHog();

	const page = usePreloadedQuery(preloadedPage);

	const defaultValues: PageFormValues = {
		title: page.title,
		content: page.content,
	};

	const updatePage = useMutation(api.externalPages.update);
	const hanldeUpdatePage = async (
		values: PageFormValues,
		published: boolean,
	) => {
		updatePage({
			id: page._id,
			title: values.title,
			content: values.content,
			published: published,
		})
			.then(() => {
				toast.success("Siden ble oppdatert!", {
					description: `Side oppdatert, ${new Date().toLocaleDateString()}`,
				});

				posthog.capture("bifrost-page_updated", {
					page_id: page._id,
					page_published: published,
				});

				router.push("/pages");
			})
			.catch((error) => {
				console.error(error, "Noe gikk galt!");

				toast.error("Noe gikk galt!", {
					description: error.message,
				});

				posthog.captureException("bifrost-page_update_error", {
					site: "bifrost",
					error,
				});
			});
	};

	const onSubmitAndPublish = (values: PageFormValues) =>
		hanldeUpdatePage(values, true);

	const onSubmitAndSave = (values: PageFormValues) =>
		hanldeUpdatePage(values, page.published);

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
