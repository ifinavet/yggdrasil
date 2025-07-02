"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ResourceForm from "@/components/resources/resource-form/resource-form";
import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";
import { getResourceById, updateResource } from "@/lib/queries/resources";

export default function EditResourceForm({ id }: { id: number }) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const { data: resource } = useQuery({
		queryKey: ["resource", id],
		queryFn: () => getResourceById(id),
		enabled: !!id,
	});

	if (!resource) return null;

	const defaultValues: ResourceFormValues = {
		title: resource.title,
		content: resource.content,
		excerpt: resource.excerpt || "",
		tag: resource.tag || "",
	};

	const { mutate } = useMutation({
		mutationFn: ({ values, published }: { values: ResourceFormValues; published: boolean }) =>
			updateResource(id, values, published),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["resource", id] });

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
