"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { semesterFromKey } from "@workspace/shared/products";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
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
import { toast } from "sonner";
import {
	BulkTaggingToolbar,
	SelectAllHead,
	SelectRowCell,
	useBulkSelection,
} from "@/components/common/bulk-tagging";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { notifyProductMutation } from "@/components/products/notify-product-mutation";
import { currentSemesterKey } from "@/components/products/semester-select";
import { FoodItemSelect, useFoodItemOptions } from "./food-item-select";
import { useFoodBackfill } from "./use-food-backfill";

export function FoodTagging() {
	const [semester, setSemester] = useState(currentSemesterKey);
	const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
	const [foodItem, setFoodItem] = useState<Id<"foodItems">>();
	const foodOptions = useFoodItemOptions() ?? [];
	useFoodBackfill();

	const events = useQuery(api.events.food.eventsForFoodTagging, semesterFromKey(semester));
	const assign = useMutation(api.events.food.bulkAssignFoodItem);

	const visible = (events ?? []).filter(
		(event) => !onlyUnconfirmed || event.foodItem === null || event.foodGuessed,
	);
	const selection = useBulkSelection<Id<"events">>(visible.map((event) => event._id));

	const assignSelected = async () => {
		if (!foodItem) return;
		const assigned = await notifyProductMutation(
			assign({ eventIds: [...selection.selected], foodItem }),
			`Maten er satt på ${selection.selected.size} arrangementer.`,
			"Kunne ikke sette mat.",
		);
		if (assigned) selection.clear();
	};

	const assignOne = async (eventId: Id<"events">, next: Id<"foodItems">) => {
		try {
			await assign({ eventIds: [eventId], foodItem: next });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke sette mat."));
		}
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
				options={foodOptions.map(({ id, label }) => ({ value: id as Id<"foodItems">, label }))}
				value={foodItem}
				onValueChange={setFoodItem}
				selectLabel="Mat"
				placeholder="Velg mat"
				selectClassName="w-60"
				assignLabel="Sett mat"
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
						<TableHead className={LIST_HEAD}>Oppgitt mat</TableHead>
						<TableHead className={LIST_HEAD}>Mat</TableHead>
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
							<TableCell className={`${LIST_CELL} font-medium`}>
								<span className="flex items-center gap-2">
									{event.title}
									{!event.published && <Badge variant="outline">Upublisert</Badge>}
								</span>
							</TableCell>
							<TableCell className={`${LIST_CELL} tabular-nums`}>
								{formatOsloDate(event.eventStart, DATE_PATTERNS.numericDate)}
							</TableCell>
							<TableCell className={LIST_CELL}>{event.companyName ?? "Ukjent bedrift"}</TableCell>
							<TableCell className={`${LIST_CELL} text-muted-foreground`}>
								{event.food ?? ""}
							</TableCell>
							<TableCell className={LIST_CELL}>
								<span className="flex items-center gap-2">
									<FoodItemSelect
										allowCreate
										value={event.foodItem ?? undefined}
										onChange={(next) => assignOne(event._id, next)}
										className="w-56"
									/>
									{event.foodGuessed && <Badge variant="outline">Gjettet</Badge>}
								</span>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
