"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { isEventProduct, semesterFromKey } from "@workspace/shared/products";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Badge } from "@workspace/ui/components/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
	BulkTaggingToolbar,
	SelectAllHead,
	SelectRowCell,
	TaggedValueCell,
	useBulkSelection,
} from "@/components/common/bulk-tagging";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { notifyProductMutation } from "../notify-product-mutation";
import { currentSemesterKey } from "../semester-select";

export function EventTagging() {
	const [semester, setSemester] = useState(currentSemesterKey);
	const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
	const [productId, setProductId] = useState<Id<"products">>();

	const events = useQuery(api.products.tagging.eventsForTagging, semesterFromKey(semester));
	const products = useQuery(api.products.queries.listActive);
	const assign = useMutation(api.products.tagging.bulkAssignEventProduct);

	const productOptions = (products ?? [])
		.filter(isEventProduct)
		.map((product) => ({ value: product._id, label: product.name }));
	const visible = (events ?? []).filter(
		(event) => !onlyUnconfirmed || event.product === null || event.productGuessed,
	);
	const selection = useBulkSelection<Id<"events">>(visible.map((event) => event._id));

	const assignSelected = async () => {
		if (!productId) return;
		const assigned = await notifyProductMutation(
			assign({ eventIds: [...selection.selected], productId }),
			`Produktet er satt på ${selection.selected.size} arrangementer.`,
			"Kunne ikke sette produkt.",
		);
		if (assigned) selection.clear();
	};

	return (
		<div className="space-y-4">
			<BulkTaggingToolbar
				semester={semester}
				onSemesterChange={(key) => {
					setSemester(key);
					selection.clear();
				}}
				onlyUnconfirmed={onlyUnconfirmed}
				onOnlyUnconfirmedChange={setOnlyUnconfirmed}
				options={productOptions}
				value={productId}
				onValueChange={setProductId}
				selectLabel="Produkt"
				placeholder="Velg produkt"
				selectClassName="w-72"
				assignLabel="Sett produkt"
				selectedCount={selection.selected.size}
				onAssign={assignSelected}
			/>

			<Table>
				<TableHeader>
					<TableRow>
						<SelectAllHead checked={selection.allSelected} onCheckedChange={selection.selectAll} />
						<TableHead className={LIST_HEAD}>Arrangement</TableHead>
						<TableHead className={LIST_HEAD}>Dato</TableHead>
						<TableHead className={LIST_HEAD}>Bedrift</TableHead>
						<TableHead className={`${LIST_HEAD} text-right`}>Kapasitet</TableHead>
						<TableHead className={LIST_HEAD}>Produkt</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visible.map((event) => (
						<TableRow key={event._id}>
							<SelectRowCell
								title={event.title}
								checked={selection.selected.has(event._id)}
								onCheckedChange={(checked) => selection.toggle(event._id, checked)}
							/>
							<TableCell className={`${LIST_CELL} font-medium`}>{event.title}</TableCell>
							<TableCell className={`${LIST_CELL} tabular-nums`}>
								{formatOsloDate(event.eventStart, DATE_PATTERNS.numericDate)}
							</TableCell>
							<TableCell className={LIST_CELL}>
								<span className="flex items-center gap-2">
									{event.companyName ?? "Ukjent bedrift"}
									{event.mainSponsor && <Badge variant="outline">Hovedsponsor</Badge>}
								</span>
							</TableCell>
							<TableCell className={`${LIST_CELL} text-right tabular-nums`}>
								{event.participationLimit}
							</TableCell>
							<TaggedValueCell label={event.product?.name} guessed={event.productGuessed} />
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
