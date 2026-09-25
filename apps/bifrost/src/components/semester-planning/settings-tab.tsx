"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SemesterActions } from "./semester-actions";
import { CreateSemesterForm } from "./settings/create-semester-form";
import { SemesterDates } from "./settings/semester-dates";
import { SemesterSettingsForm } from "./settings/semester-settings-form";
import { StatusControl } from "./settings/status-control";

// The two cards sit side by side, so they keep the same tighter padding.
const CARD = "gap-4 py-4 sm:py-4.5";
const CARD_PART = "px-4 sm:px-5";

/**
 * The Innstillinger tab: the semester's status, dates, deadline and texts, and the list of
 * presentation days.
 */
export function SettingsTab({
	semester,
	onCreated,
}: Readonly<{
	semester: Doc<"semesters">;
	onCreated: (semester: Id<"semesters">) => void;
}>) {
	return (
		<>
			<SemesterActions>
				<NewSemesterButton onCreated={onCreated} />
			</SemesterActions>
			<div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
				<Card className={CARD}>
					<CardHeader className={CARD_PART}>
						<CardTitle className="text-base">Semester</CardTitle>
						<CardDescription>Datoer og frist settes av deg, aldri automatisk.</CardDescription>
					</CardHeader>
					<CardContent className={cn(CARD_PART, "grid gap-3.5")}>
						<StatusControl semester={semester} />
						<SemesterSettingsForm key={semester._id} semester={semester} />
					</CardContent>
				</Card>
				<DatesCard semester={semester} />
			</div>
		</>
	);
}

function DatesCard({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const data = useQuery(api.semesterPlanning.semesters.queries.get, { semesterId: semester._id });
	const dates = data?.dates ?? [];

	return (
		<Card className={cn(CARD, "min-w-0")}>
			<CardHeader className={CARD_PART}>
				<CardTitle className="text-base">Datoer</CardTitle>
				<CardDescription>
					Tirsdager og torsdager mellom første og siste dato. Klikk en dato for å stenge den.
				</CardDescription>
			</CardHeader>
			<CardContent className={CARD_PART}>
				{data === undefined ? (
					<output className="text-muted-foreground text-sm">Henter datoer …</output>
				) : dates.length === 0 ? (
					<div className="rounded-lg border border-dashed px-4 py-10 text-center">
						<p className="font-medium text-sm">Ingen datoer ennå</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Velg første og siste dato og lagre, så lages tirsdagene og torsdagene her.
						</p>
					</div>
				) : (
					<SemesterDates dates={dates} locked={semester.status === "closed"} />
				)}
			</CardContent>
		</Card>
	);
}

function NewSemesterButton({
	onCreated,
}: Readonly<{ onCreated: (semester: Id<"semesters">) => void }>) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button variant="outline" onClick={() => setOpen(true)}>
				<Plus /> Nytt semester
			</Button>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Nytt semester</DialogTitle>
					<DialogDescription>Velg semester og år.</DialogDescription>
				</DialogHeader>
				<CreateSemesterForm
					onCancel={() => setOpen(false)}
					onCreated={(semesterId) => {
						setOpen(false);
						onCreated(semesterId);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

/** Shown to editors while there is no semester at all: the form for creating the first one. */
export function FirstSemester({
	onCreated,
}: Readonly<{ onCreated: (semester: Id<"semesters">) => void }>) {
	return (
		<Card className="mx-auto w-full max-w-md gap-4 py-4 sm:py-6">
			<CardHeader className="px-4 sm:px-6">
				<CardTitle className="text-base">Opprett det første semesteret</CardTitle>
				<CardDescription>
					Det finnes ingen semestre ennå. Opprett ett for å sette datoer og ta imot søknader fra
					bedrifter.
				</CardDescription>
			</CardHeader>
			<CardContent className="px-4 sm:px-6">
				<CreateSemesterForm onCreated={onCreated} />
			</CardContent>
		</Card>
	);
}
