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
import { notifyProductMutation } from "./notify-product-mutation";
import { moveProductId } from "./product-history-format";

const HEAD = "h-10 px-3 text-[13px] text-muted-foreground";
const CELL = "px-3 py-2.5";

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
					<TableHead className={HEAD}>Produkt</TableHead>
					<TableHead className={HEAD}>Kategori</TableHead>
					<TableHead className={HEAD}>Pris eks. mva.</TableHead>
					<TableHead className={HEAD}>Status</TableHead>
					<TableHead className={`${HEAD} w-24`}>Rekkefølge</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{products.map((product, index) => (
					<TableRow key={product._id}>
						<TableCell className={CELL}>
							<Link href={`/products/${product._id}`} className="font-medium hover:underline">
								{product.name}
							</Link>
						</TableCell>
						<TableCell className={CELL}>
							<ProductCategoryBadge category={product.category} />
						</TableCell>
						<TableCell className={CELL}>{productPriceLabel(product)}</TableCell>
						<TableCell className={CELL}>
							<ProductStatusBadge active={product.active} />
						</TableCell>
						<TableCell className={CELL}>
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
