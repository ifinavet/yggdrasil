"use client";

import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { notifyProductMutation } from "./notify-product-mutation";
import ProductForm from "./product-form";
import { emptyProductFormValues, toProductInput } from "./product-form-values";

export function CreateProduct() {
	const router = useRouter();
	const create = useMutation(api.products.mutations.create);

	return (
		<ProductForm
			title="Nytt produkt"
			defaultValues={emptyProductFormValues}
			submitLabel="Opprett produkt"
			onSubmit={async (values) => {
				const created = await notifyProductMutation(
					create(toProductInput(values)),
					"Produktet er opprettet.",
					"Kunne ikke opprette produktet.",
				);
				if (created) router.push("/products");
			}}
		/>
	);
}
