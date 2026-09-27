"use client";

import { previousSemesters, STATS_WINDOW_SIZE } from "@workspace/shared/products";
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
import { TableCell, TableHead } from "@workspace/ui/components/table";
import { useState } from "react";
import { includesAll, withToggled } from "@/components/common/bulk-selection";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { currentSemester, SemesterSelect } from "@/components/products/semester-select";

export function useBulkSelection<T extends string>(visibleIds: readonly T[]) {
	const [selected, setSelected] = useState<ReadonlySet<T>>(new Set());

	return {
		selected,
		allSelected: includesAll(selected, visibleIds),
		toggle: (id: T, checked: boolean) => setSelected(withToggled(selected, id, checked)),
		selectAll: (checked: boolean) => setSelected(new Set(checked ? visibleIds : [])),
		clear: () => setSelected(new Set()),
	};
}

export function BulkTaggingToolbar<T extends string>({
	semester,
	onSemesterChange,
	onlyUnconfirmed,
	onOnlyUnconfirmedChange,
	options,
	value,
	onValueChange,
	selectLabel,
	placeholder,
	selectClassName,
	assignLabel,
	selectedCount,
	onAssign,
}: Readonly<{
	semester: string;
	onSemesterChange: (key: string) => void;
	onlyUnconfirmed: boolean;
	onOnlyUnconfirmedChange: (checked: boolean) => void;
	options: readonly { value: T; label: string }[];
	value: T | undefined;
	onValueChange: (value: T) => void;
	selectLabel: string;
	placeholder: string;
	selectClassName: string;
	assignLabel: string;
	selectedCount: number;
	onAssign: () => void;
}>) {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<SemesterSelect
				semesters={previousSemesters(currentSemester(), STATS_WINDOW_SIZE)}
				value={semester}
				onChange={onSemesterChange}
			/>
			<div className="flex items-center gap-2">
				<Switch
					id="only-unconfirmed"
					checked={onlyUnconfirmed}
					onCheckedChange={onOnlyUnconfirmedChange}
				/>
				<Label htmlFor="only-unconfirmed">Bare gjettede og umerkede</Label>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<Select value={value ?? ""} onValueChange={(next) => onValueChange(next as T)}>
					<SelectTrigger className={selectClassName} aria-label={selectLabel}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button disabled={!value || selectedCount === 0} onClick={onAssign}>
					{assignLabel} ({selectedCount})
				</Button>
			</div>
		</div>
	);
}

export function SelectAllHead({
	checked,
	onCheckedChange,
}: Readonly<{ checked: boolean; onCheckedChange: (checked: boolean) => void }>) {
	return (
		<TableHead className={`${LIST_HEAD} w-10`}>
			<Checkbox
				aria-label="Velg alle"
				checked={checked}
				onCheckedChange={(next) => onCheckedChange(next === true)}
			/>
		</TableHead>
	);
}

export function TaggedValueCell({
	label,
	guessed,
}: Readonly<{ label: string | undefined; guessed: boolean }>) {
	return (
		<TableCell className={LIST_CELL}>
			{label ? (
				<span className="flex items-center gap-2">
					{label}
					{guessed && <Badge variant="outline">Gjettet</Badge>}
				</span>
			) : (
				<span className="text-muted-foreground">Ikke satt</span>
			)}
		</TableCell>
	);
}

export function SelectRowCell({
	title,
	checked,
	onCheckedChange,
}: Readonly<{ title: string; checked: boolean; onCheckedChange: (checked: boolean) => void }>) {
	return (
		<TableCell className={LIST_CELL}>
			<Checkbox
				aria-label={`Velg ${title}`}
				checked={checked}
				onCheckedChange={(next) => onCheckedChange(next === true)}
			/>
		</TableCell>
	);
}
