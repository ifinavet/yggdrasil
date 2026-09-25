"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useMutation, useQuery } from "convex/react";
import { Archive, ArchiveRestore } from "lucide-react";
import { notifyProductMutation } from "./notify-product-mutation";
import ProductForm from "./product-form";
import { toProductFormValues, toProductInput } from "./product-form-values";
import { ProductHistory } from "./product-history";

export function EditProduct({ id }: Readonly<{ id: Id<"products"> }>) {
	const data = useQuery(api.products.queries.getWithChanges, { id });
	const update = useMutation(api.products.mutations.update);
	const setActive = useMutation(api.products.mutations.setActive);

	if (!data) return null;
	const { product, changes } = data;

	return (
		<div className="space-y-10">
			<ProductForm
				key={product._id}
				defaultValues={toProductFormValues(product)}
				submitLabel="Lagre endringer"
				onSubmit={(values) =>
					notifyProductMutation(
						update({ id, ...toProductInput(values) }),
						"Produktet er lagret.",
						"Kunne ikke lagre produktet.",
					)
				}
			/>
			<Button
				variant="outline"
				onClick={() =>
					notifyProductMutation(
						setActive({ id, active: !product.active }),
						product.active ? "Produktet er arkivert." : "Produktet er gjenopprettet.",
						"Kunne ikke endre status.",
					)
				}
			>
				{product.active ? <Archive /> : <ArchiveRestore />}
				{product.active ? "Arkiver produkt" : "Gjenopprett produkt"}
			</Button>
			<ProductHistory changes={changes} />
		</div>
	);
}
