"use client";

import { Authenticated } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import { refineStudentProfile, type StudentProfile } from "@workspace/shared/constants";
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
import { useState } from "react";
import { toast } from "sonner";
import {
	STUDY_FIELDS,
	StudyFields,
	type StudyValues,
	studySchema,
} from "@/components/profile/study-fields";
import { useAppForm } from "@/lib/form";

export default function GraduatedProfileModal() {
	return (
		<Authenticated>
			<GraduatedProfile />
		</Authenticated>
	);
}

function GraduatedProfile() {
	const profile = useQuery(api.users.students.queries.graduatedProfile);
	const [dismissed, setDismissed] = useState(false);
	if (!profile) return null;
	return (
		<Dialog open={!dismissed} onOpenChange={(open) => setDismissed(!open)}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Hva studerer du nå?</DialogTitle>
					<DialogDescription>Hjelp oss å holde informasjonen din oppdatert.</DialogDescription>
				</DialogHeader>
				<StudyForm profile={profile} />
			</DialogContent>
		</Dialog>
	);
}

function StudyForm({ profile }: Readonly<{ profile: StudentProfile }>) {
	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
	const form = useAppForm({
		defaultValues: profile as StudyValues,
		validators: {
			onSubmit: studySchema.superRefine(refineStudentProfile),
		},
		onSubmit: ({ value }) =>
			updateProfile(value)
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
