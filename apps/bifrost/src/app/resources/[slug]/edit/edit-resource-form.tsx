"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import ResourceForm from "@/components/resources/resource-form";
import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";

export default function EditResourceForm({
	id,
}: Readonly<{ id: Id<"resources"> }>) {
	const router = useRouter();

	const posthog = usePostHog();

	const resource = useQuery(api.resources.getById, { id: id });
	const updateResource = useMutation(api.resources.update);

	if (!resource) {
		return null;
	}

	const defaultValues: ResourceFormValues = {
		title: resource.title,
		content: resource.content,
		excerpt: resource.excerpt,
		tag: resource.tag ?? "",
		icon: resource.icon ?? "",
		gradient: resource.gradient ?? "",
	};
	const handleUpdateResource = async (
		values: ResourceFormValues,
		published: boolean,
	) => {
		await updateResource({
			id,
			title: values.title,
			excerpt: values.excerpt,
			content: values.content,
			tag: values.tag,
			icon: values.icon,
			published,
		})
			.then(() => {
				toast.success("Ressurs opprettet!", {
					description: `Ressurs opprettet, ${new Date().toLocaleDateString()}`,
				});

				posthog.capture("bifrost-resource_updated", {
					resource_id: id,
					resource_published: published,
				});

				router.push("/resources");
			})
			.catch((error) => {
				console.error("Noe gikk galt!", error);

				toast.error("Noe gikk galt!", {
					description: error.message,
				});

				posthog.captureException("bifrost-resource_update_error", {
					site: "bifrost",
					error,
				});
			});
	};

	const onSubmitAndPublish = (values: ResourceFormValues) =>
		handleUpdateResource(values, true);

	const onSubmitAndSave = (values: ResourceFormValues) =>
		handleUpdateResource(values, resource.published);

	const onSubmitAndUnpublish = () => handleUpdateResource(defaultValues, false);

	return (
		<ResourceForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={onSubmitAndPublish}
			onSecondarySubmitAction={onSubmitAndSave}
			onTertiarySubmitAction={onSubmitAndUnpublish}
		/>
	);
}
