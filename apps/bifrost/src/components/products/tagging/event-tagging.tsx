"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	isEventProduct,
	previousSemesters,
	STATS_WINDOW_SIZE,
	semesterFromKey,
} from "@workspace/shared/products";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
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
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { notifyProductMutation } from "../notify-product-mutation";
import { currentSemester, currentSemesterKey, SemesterSelect } from "../semester-select";

export function EventTagging() {
	const [semester, setSemester] = useState(currentSemesterKey);
	const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
	const [selected, setSelected] = useState<ReadonlySet<Id<"events">>>(new Set());
	const [productId, setProductId] = useState<Id<"products">>();

	const events = useQuery(api.products.tagging.eventsForTagging, semesterFromKey(semester));
	const products = useQuery(api.products.queries.listActive);
	const assign = useMutation(api.products.tagging.bulkAssignEventProduct);

	const eventProducts = (products ?? []).filter(isEventProduct);
	const visible = (events ?? []).filter(
		(event) => !onlyUnconfirmed || event.product === null || event.productGuessed,
	);
	const allSelected = visible.length > 0 && visible.every((event) => selected.has(event._id));

	const toggle = (eventId: Id<"events">, checked: boolean) => {
		const next = new Set(selected);
		if (checked) next.add(eventId);
		else next.delete(eventId);
		setSelected(next);
	};

	const assignSelected = async () => {
		if (!productId) return;
		const assigned = await notifyProductMutation(
			assign({ eventIds: [...selected], productId }),
			`Produktet er satt på ${selected.size} arrangementer.`,
			"Kunne ikke sette produkt.",
		);
		if (assigned) setSelected(new Set());
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-4">
				<SemesterSelect
					semesters={previousSemesters(currentSemester(), STATS_WINDOW_SIZE)}
					value={semester}
					onChange={(key) => {
						setSemester(key);
						setSelected(new Set());
					}}
				/>
				<div className="flex items-center gap-2">
					<Switch
						id="only-unconfirmed"
						checked={onlyUnconfirmed}
						onCheckedChange={setOnlyUnconfirmed}
					/>
					<Label htmlFor="only-unconfirmed">Bare gjettede og umerkede</Label>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Select
						value={productId ?? ""}
						onValueChange={(value) => setProductId(value as Id<"products">)}
					>
						<SelectTrigger className="w-72" aria-label="Produkt">
							<SelectValue placeholder="Velg produkt" />
						</SelectTrigger>
						<SelectContent>
							{eventProducts.map((product) => (
								<SelectItem key={product._id} value={product._id}>
									{product.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button disabled={!productId || selected.size === 0} onClick={assignSelected}>
						Sett produkt ({selected.size})
					</Button>
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={`${LIST_HEAD} w-10`}>
							<Checkbox
								aria-label="Velg alle"
								checked={allSelected}
								onCheckedChange={(checked) =>
									setSelected(new Set(checked ? visible.map((event) => event._id) : []))
								}
							/>
						</TableHead>
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
							<TableCell className={LIST_CELL}>
								<Checkbox
									aria-label={`Velg ${event.title}`}
									checked={selected.has(event._id)}
									onCheckedChange={(checked) => toggle(event._id, checked === true)}
								/>
							</TableCell>
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
							<TableCell className={LIST_CELL}>
								{event.product ? (
									<span className="flex items-center gap-2">
										{event.product.name}
										{event.productGuessed && <Badge variant="outline">Gjettet</Badge>}
									</span>
								) : (
									<span className="text-muted-foreground">Ikke satt</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
