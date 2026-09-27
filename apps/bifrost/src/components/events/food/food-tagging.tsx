"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { FOOD_ITEM_LABELS, FOOD_ITEMS, type FoodItem } from "@workspace/shared/events/food";
import { previousSemesters, STATS_WINDOW_SIZE, semesterFromKey } from "@workspace/shared/products";
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
import { notifyProductMutation } from "@/components/products/notify-product-mutation";
import {
	currentSemester,
	currentSemesterKey,
	SemesterSelect,
} from "@/components/products/semester-select";
import { useFoodBackfill } from "./use-food-backfill";

export function FoodTagging() {
	const [semester, setSemester] = useState(currentSemesterKey);
	const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
	const [selected, setSelected] = useState<ReadonlySet<Id<"events">>>(new Set());
	const [foodItem, setFoodItem] = useState<FoodItem>();
	useFoodBackfill();

	const events = useQuery(api.events.food.eventsForFoodTagging, semesterFromKey(semester));
	const assign = useMutation(api.events.food.bulkAssignFoodItem);

	const visible = (events ?? []).filter(
		(event) => !onlyUnconfirmed || event.foodItem === null || event.foodGuessed,
	);
	const allSelected = visible.length > 0 && visible.every((event) => selected.has(event._id));

	const toggle = (eventId: Id<"events">, checked: boolean) => {
		const next = new Set(selected);
		if (checked) next.add(eventId);
		else next.delete(eventId);
		setSelected(next);
	};

	const assignSelected = async () => {
		if (!foodItem) return;
		const assigned = await notifyProductMutation(
			assign({ eventIds: [...selected], foodItem }),
			`Maten er satt på ${selected.size} arrangementer.`,
			"Kunne ikke sette mat.",
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
					<Select value={foodItem ?? ""} onValueChange={(value) => setFoodItem(value as FoodItem)}>
						<SelectTrigger className="w-60" aria-label="Mat">
							<SelectValue placeholder="Velg mat" />
						</SelectTrigger>
						<SelectContent>
							{FOOD_ITEMS.map((item) => (
								<SelectItem key={item} value={item}>
									{FOOD_ITEM_LABELS[item]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button disabled={!foodItem || selected.size === 0} onClick={assignSelected}>
						Sett mat ({selected.size})
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
						<TableHead className={LIST_HEAD}>Oppgitt mat</TableHead>
						<TableHead className={LIST_HEAD}>Mat</TableHead>
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
								{event.foodItem ? (
									<span className="flex items-center gap-2">
										{FOOD_ITEM_LABELS[event.foodItem]}
										{event.foodGuessed && <Badge variant="outline">Gjettet</Badge>}
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
