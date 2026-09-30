"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export function useFoodItemOptions() {
	const foodItems = useQuery(api.events.food.listFoodItems);
	return foodItems?.map(({ _id, name }) => ({ id: _id, label: name }));
}

export function FoodItemSelect({
	value,
	onChange,
	allowCreate = false,
	id,
	invalid,
	className,
}: Readonly<{
	value: Id<"foodItems"> | undefined;
	onChange: (foodItem: Id<"foodItems">) => void;
	allowCreate?: boolean;
	id?: string;
	invalid?: boolean;
	className?: string;
}>) {
	const items = useFoodItemOptions();
	const createFoodItem = useMutation(api.events.food.createFoodItem);

	const create = async (name: string) => {
		try {
			onChange(await createFoodItem({ name }));
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke lage matvalget."));
		}
	};

	return (
		<SearchSelect
			id={id}
			aria-invalid={invalid}
			items={items}
			value={value}
			onChange={(next) => {
				if (next) onChange(next as Id<"foodItems">);
			}}
			onCreate={allowCreate ? create : undefined}
			placeholder="Velg mat"
			searchPlaceholder="Søk etter mat..."
			emptyText="Fant ingen mat."
			className={className}
		/>
	);
}
