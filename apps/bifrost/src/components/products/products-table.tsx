"use client";

import { api } from "@workspace/backend/convex/api";
import { productPriceLabel } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import {
	ProductCategoryBadge,
	ProductStatusBadge,
} from "@workspace/ui/components/products/product-badges";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { notifyProductMutation } from "./notify-product-mutation";
import { moveProductId } from "./product-history-format";
import { PRODUCT_ROUTES } from "./product-routes";

export function ProductsTable() {
	const products = useQuery(api.products.queries.listAll, {});
	const reorder = useMutation(api.products.mutations.reorder);
	const [reordering, setReordering] = useState(false);

	if (!products) return null;

	const ids = products.map((product) => product._id);
	const move = async (index: number, offset: number) => {
		setReordering(true);
		await notifyProductMutation(
			reorder({ ids: moveProductId(ids, index, offset) }),
			"Rekkefølgen er lagret.",
			"Kunne ikke endre rekkefølgen.",
		);
		setReordering(false);
	};

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className={LIST_HEAD}>Produkt</TableHead>
					<TableHead className={LIST_HEAD}>Kategori</TableHead>
					<TableHead className={LIST_HEAD}>Pris eks. mva.</TableHead>
					<TableHead className={LIST_HEAD}>Status</TableHead>
					<TableHead className={`${LIST_HEAD} w-24`}>Rekkefølge</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{products.map((product, index) => (
					<TableRow key={product._id}>
						<TableCell className={LIST_CELL}>
							<Link
								href={PRODUCT_ROUTES.detail(product._id)}
								className="font-medium hover:underline"
							>
								{product.name}
							</Link>
						</TableCell>
						<TableCell className={LIST_CELL}>
							<ProductCategoryBadge category={product.category} />
						</TableCell>
						<TableCell className={LIST_CELL}>{productPriceLabel(product)}</TableCell>
						<TableCell className={LIST_CELL}>
							<ProductStatusBadge active={product.active} />
						</TableCell>
						<TableCell className={LIST_CELL}>
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Flytt ${product.name} opp`}
									disabled={reordering || index === 0}
									onClick={() => move(index, -1)}
								>
									<ArrowUp />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Flytt ${product.name} ned`}
									disabled={reordering || index === products.length - 1}
									onClick={() => move(index, 1)}
								>
									<ArrowDown />
								</Button>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
