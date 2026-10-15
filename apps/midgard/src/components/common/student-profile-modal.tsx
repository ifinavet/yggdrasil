"use client";

import { Authenticated } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import {
	DEGREE_TYPES,
	refineStudentProfile,
	STUDY_PROGRAMS,
	type StudentProfile,
} from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { FieldSet } from "@workspace/ui/components/field";
import { useMutation, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	STUDY_FIELDS,
	StudyFields,
	type StudyValues,
	studySchema,
} from "@/components/profile/study-fields";
import { useAppForm } from "@/lib/form";

export default function StudentProfileModal() {
	return (
		<Authenticated>
			<GraduatedProfile />
			<MissingProfile />
		</Authenticated>
	);
}

function GraduatedProfile() {
	const profile = useQuery(api.users.students.queries.graduatedProfile);
	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
	const [dismissed, setDismissed] = useState(false);
	if (!profile) return null;
	return (
		<Dialog open={!dismissed} onOpenChange={(open) => setDismissed(!open)}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Hva studerer du nå?</DialogTitle>
					<DialogDescription>Vi tror du studerer dette, stemmer det?</DialogDescription>
				</DialogHeader>
				<StudyForm defaultValues={profile} save={updateProfile} />
			</DialogContent>
		</Dialog>
	);
}

// Sign-up creates the profile itself, so the prompt waits until the visitor has left that page.
function MissingProfile() {
	const pathname = usePathname();
	const missing = useQuery(api.users.students.queries.missingProfile);
	const createProfile = useMutation(api.users.students.mutations.createByExternalId);
	if (!missing || pathname.startsWith("/sign-up")) return null;
	return (
		<Dialog open>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Fullfør studentprofilen din</DialogTitle>
					<DialogDescription>
						Vi mangler studieinformasjonen din. Fyll den inn for å fortsette.
					</DialogDescription>
				</DialogHeader>
				<StudyForm
					defaultValues={{ studyProgram: STUDY_PROGRAMS[0], degree: DEGREE_TYPES[1], year: 1 }}
					save={(value) => createProfile({ ...value, ...missing })}
				/>
			</DialogContent>
		</Dialog>
	);
}

function StudyForm({
	defaultValues,
	save,
}: Readonly<{ defaultValues: StudentProfile; save: (value: StudyValues) => Promise<unknown> }>) {
	const form = useAppForm({
		defaultValues: defaultValues as StudyValues,
		validators: {
			onSubmit: studySchema.superRefine(refineStudentProfile),
		},
		onSubmit: ({ value }) =>
			save(value)
				.then(() => {
					toast.success("Profilen ble oppdatert!");
				})
				.catch(() => {
					toast.error("Oi! Det oppstod en feil! Prøv igjen senere.");
				}),
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<FieldSet>
				<StudyFields form={form} fields={STUDY_FIELDS} />
			</FieldSet>
			<DialogFooter>
				<Button type="submit" className="text-primary-foreground">
					Lagre
				</Button>
			</DialogFooter>
		</form>
	);
}
