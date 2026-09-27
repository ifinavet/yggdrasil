"use client";

import { api } from "@workspace/backend/convex/api";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { useStableQuery } from "@/hooks/use-stable-query";
import {
	DEMAND_NOTE,
	type FoodRow,
	fillShare,
	formatMetric,
	METRICS,
	type MetricKey,
} from "./engagement-format";
import { useSemesterSelect } from "./semester-select";

const NUMBER_HEAD = `${LIST_HEAD} text-right`;
const NUMBER_CELL = `${LIST_CELL} text-right tabular-nums`;

function MetricValue({ metric, value }: Readonly<{ metric: MetricKey; value: number | null }>) {
	return formatMetric(metric, value) ?? <span className="text-muted-foreground">Ikke målt</span>;
}

function FoodTable({ foods }: Readonly<{ foods: FoodRow[] }>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Mat</TableHead>
					<TableHead className={NUMBER_HEAD}>Arrangementer</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.demand.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.attendance.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.latePerEvent.label}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{foods.map((food) => (
					<TableRow key={food.foodItem ?? "unset"}>
						<TableCell className={`${LIST_CELL} font-medium`}>
							{food.name ?? <span className="text-muted-foreground">Ikke satt</span>}
						</TableCell>
						<TableCell className={NUMBER_CELL}>{food.events}</TableCell>
						<TableCell className={LIST_CELL}>
							<div className="whitespace-nowrap tabular-nums">
								{food.registered} / {food.seats}
								<div className="mt-1.5 w-24">
									<ShareBar
										share={fillShare(food.registered, food.seats)}
										color={PRIMARY_SERIES_COLOR}
									/>
								</div>
							</div>
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="demand" value={food.demand} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="attendance" value={food.attendance} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="latePerEvent" value={food.latePerEvent} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function Foods({ foods }: Readonly<{ foods: FoodRow[] | undefined }>) {
	if (!foods) {
		return (
			<PanelBody>
				<Skeleton className="h-48 w-full" />
			</PanelBody>
		);
	}
	if (!foods.length) {
		return (
			<PanelBody>
				<PanelNote>Ingen arrangementer med påmelding dette semesteret.</PanelNote>
			</PanelBody>
		);
	}
	return (
		<>
			<FoodTable foods={foods} />
			<PanelBody>
				<PanelNote>{DEMAND_NOTE}</PanelNote>
			</PanelBody>
		</>
	);
}

export function FoodsView({ now }: Readonly<{ now: number }>) {
	const { selected, select } = useSemesterSelect(now);
	const foods = useStableQuery(
		api.engagement.companies.foods,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);

	return (
		<Panel title="Arrangementer per mat" aside={select}>
			<Foods foods={foods} />
		</Panel>
	);
}
