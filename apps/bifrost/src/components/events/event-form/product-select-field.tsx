"use client";

import { api } from "@workspace/backend/convex/api";
import { isEventProduct, productPriceLabel } from "@workspace/shared/products";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useQuery } from "convex/react";

type CurrentProduct = { productId: string; name: string };

export default function ProductSelectField({
	name,
	value,
	onChange,
	errors,
	currentProduct,
}: Readonly<{
	name: string;
	value: string | undefined;
	onChange: (productId: string) => void;
	errors?: ({ message?: string } | undefined)[];
	currentProduct?: CurrentProduct;
}>) {
	const products = useQuery(api.products.queries.listActive);
	const options = (products ?? []).filter(isEventProduct).map((product) => ({
		id: product._id as string,
		label: `${product.name} (${productPriceLabel(product)})`,
	}));
	if (currentProduct && !options.some((option) => option.id === currentProduct.productId)) {
		options.unshift({ id: currentProduct.productId, label: currentProduct.name });
	}

	return (
		<Field>
			<FieldLabel htmlFor={name}>Produkt</FieldLabel>
			<Select value={value ?? ""} onValueChange={onChange}>
				<SelectTrigger id={name} className="w-full md:w-96">
					<SelectValue placeholder="Velg produkt" />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.id} value={option.id}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{errors && errors.length > 0 && <FieldError errors={errors} />}
		</Field>
	);
}
