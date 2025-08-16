"use client";

import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageForm from "@/components/pages/page-form";
import type { PageFormValues } from "@/constants/schemas/page-form-schema";

export default function NewPageForm() {
	const router = useRouter();

	const defaultValues: PageFormValues = {
		title: "",
		content: "",
	};

	const createPage = useMutation(api.externalPages.create);
	const handleCreatePage = async (values: PageFormValues, published: boolean) => {
		createPage({ title: values.title, content: values.content, published })
			.then(() => {
				toast.success("Siden har blitt opprettet!", {
					description: `Side opprettet, ${new Date().toLocaleDateString()}`,
				});
				router.push("/pages");
			})
			.catch((error) => {
				console.error(error);
				console.error("Noe gikk galt!");
				toast.error("Noe gikk galt!", {
					description: error.message,
				});
			});
	};
	const onSubmitAndPublish = (values: PageFormValues) => {
		handleCreatePage(values, true);
	};

	const onSubmitAndSave = (values: PageFormValues) => {
		handleCreatePage(values, false);
	};

	return (
		<PageForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={onSubmitAndPublish}
			onSecondarySubmitAction={onSubmitAndSave}
		/>
	);
}
