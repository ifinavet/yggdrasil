"use client";

import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/resources/resource-form/resource-form";
import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";

export default function NewResourceForm() {
	const router = useRouter();

	const defaultValues: ResourceFormValues = {
		title: "",
		content: "",
		excerpt: "",
		tag: "",
	};

	const createResource = useMutation(api.resources.create);
	const hanldeCreateResource = async (values: ResourceFormValues, published: boolean) => {
		createResource({
			title: values.title,
			excerpt: values.excerpt,
			content: values.content,
			tag: values.tag,
			published,
		})
			.then(() => {
				toast.success("Ressurs opprettet!", {
					description: `Ressurs opprettet, ${new Date().toLocaleDateString()}`,
				});
				router.push("/resources");
			})
			.catch((error) => {
				console.error("Error creating resource:", error);
				toast.error("Noe gikk galt!", {
					description: error.message,
				});
			});
	};

	const onSubmitAndPublish = (values: ResourceFormValues) => hanldeCreateResource(values, true);
	const onSubmitAndSave = (values: ResourceFormValues) => hanldeCreateResource(values, false);

	return (
		<ResourceForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={onSubmitAndPublish}
			onSecondarySubmitAction={onSubmitAndSave}
		/>
	);
}
