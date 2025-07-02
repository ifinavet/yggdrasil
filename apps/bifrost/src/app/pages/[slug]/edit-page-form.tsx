"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { getPageById, updatePage } from "@/lib/queries/pages";

export default function EditPageForm({ id }: { id: number }) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const { data: resource } = useQuery({
		queryKey: ["page", id],
		queryFn: () => getPageById(id),
		enabled: !!id,
	});

	if (!resource) return null;

	const defaultValues: PageFormValues = {
		title: resource.title,
		content: resource.content,
	};

	const { mutate } = useMutation({
		mutationFn: ({ values, published }: { values: PageFormValues; published: boolean }) =>
			updatePage(id, values, published),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["page", id] });

			toast.success("Siden ble oppdatert!", {
				description: `Side oppdatert, ${new Date().toLocaleDateString()}`,
			});
			router.push("/pages");
		},
		onError: (error) => {
			console.error(error);
			console.error("Noe gikk galt!");
			toast.error("Noe gikk galt!", {
				description: error.message,
			});
		},
	});

	const onSubmitAndPublish = (values: PageFormValues) => {
		mutate({ values, published: true });
	};

	const onSubmitAndSave = (values: PageFormValues) => {
		mutate({ values, published: resource.published });
	};

	const onSubmitAndUnpublish = () => {
		mutate({ values: defaultValues, published: false });
	};

	return (
		<PageForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={onSubmitAndPublish}
			onSecondarySubmitAction={onSubmitAndSave}
			onTertiarySubmitAction={onSubmitAndUnpublish}
		/>
	);
}
