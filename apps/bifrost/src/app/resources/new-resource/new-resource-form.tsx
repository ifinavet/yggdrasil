"use client";

import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/resources/resource-form";
import { cardColors } from "@/constants/resource-constants";
import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";

export default function NewResourceForm() {
	const router = useRouter();

	const cardColorKeys = Object.keys(cardColors) as Array<
		keyof typeof cardColors
	>;
	const randomKey =
		cardColorKeys[Math.floor(Math.random() * cardColorKeys.length)];

	const defaultValues: ResourceFormValues = {
		title: "",
		content: "",
		excerpt: "",
		tag: "",
		gradient: cardColors[randomKey ?? "blue"],
		icon: "pencil",
	};

	const createResource = useMutation(api.resources.create);
	const handleCreateResource = async (
		values: ResourceFormValues,
		published: boolean,
	) => {
		createResource({
			title: values.title,
			excerpt: values.excerpt,
			content: values.content,
			tag: values.tag,
			gradient: randomKey ?? "slate",
			icon: values.icon,
			published,
		})
			.then(() => {
				toast.success("Resource created!", {
					description: `Resource created, ${new Date().toLocaleDateString()}`,
				});
				router.push("/resources");
			})
			.catch((error) => {
				console.error("Error creating resource:", error);
				toast.error("Something went wrong!", {
					description: error.message,
				});
			});
	};

	const onSubmitAndPublish = (values: ResourceFormValues) =>
		handleCreateResource(values, true);
	const onSubmitAndSave = (values: ResourceFormValues) =>
		handleCreateResource(values, false);

	return (
		<ResourceForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={onSubmitAndPublish}
			onSecondarySubmitAction={onSubmitAndSave}
		/>
	);
}
