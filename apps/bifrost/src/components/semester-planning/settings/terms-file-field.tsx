"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { termsPath } from "@workspace/shared/semester/application";
import { MAX_TERMS_FILE_BYTES } from "@workspace/shared/semester/limits";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

const TOO_LARGE = `Velg en PDF på høyst ${MAX_TERMS_FILE_BYTES / 1024 / 1024} MB.`;

/**
 * «Standardvilkår»: the terms as a PDF, uploaded at once and shown to companies on a page in Hugin.
 * An older semester can still have a link instead, which the PDF replaces.
 */
export function TermsFileField({
	semester,
	locked,
}: Readonly<{ semester: Doc<"semesters">; locked: boolean }>) {
	const generateUploadUrl = useMutation(
		api.semesterPlanning.semesters.mutations.generateTermsUploadUrl,
	);
	const setTermsFile = useMutation(api.semesterPlanning.semesters.mutations.setTermsFile);
	const { pending, error, run } = useAsyncAction();
	const input = useRef<HTMLInputElement>(null);

	const upload = (file: File) =>
		run(
			async () => {
				if (file.type !== "application/pdf" || file.size > MAX_TERMS_FILE_BYTES) {
					throw new ConvexError(TOO_LARGE);
				}
				const response = await fetch(await generateUploadUrl(), {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});
				if (!response.ok) throw new ConvexError("Kunne ikke laste opp PDF-en.");
				const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
				await setTermsFile({ semesterId: semester._id, fileId: storageId });
			},
			() => toast.success("Standardvilkårene er lastet opp."),
			"Kunne ikke laste opp PDF-en.",
		);

	return (
		<Field>
			<FieldLabel htmlFor="semester-terms">Standardvilkår</FieldLabel>
			<input
				ref={input}
				id="semester-terms"
				type="file"
				accept="application/pdf"
				className="sr-only"
				tabIndex={-1}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void upload(file);
				}}
			/>
			<div className="flex flex-wrap items-center gap-2">
				{semester.termsFileId ? (
					<Button asChild variant="outline" size="sm">
						<a href={`${huginUrl()}${termsPath(semester._id)}`} target="_blank" rel="noreferrer">
							<FileText /> Vis PDF <ExternalLink />
						</a>
					</Button>
				) : (
					semester.termsUrl && (
						<span className="min-w-0 truncate text-muted-foreground text-sm">
							Lenke: {semester.termsUrl}
						</span>
					)
				)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={locked || pending}
					onClick={() => input.current?.click()}
				>
					<Upload /> {semester.termsFileId ? "Bytt PDF" : "Last opp PDF"}
				</Button>
				{semester.termsFileId && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={locked || pending}
						onClick={() =>
							run(
								() => setTermsFile({ semesterId: semester._id, fileId: null }),
								() => toast.success("Standardvilkårene er fjernet."),
							)
						}
					>
						<X /> Fjern
					</Button>
				)}
			</div>
			{error ? (
				<p className="text-destructive text-sm">{error}</p>
			) : (
				<FieldDescription>Bedriftene leser PDF-en på en egen side i Hugin.</FieldDescription>
			)}
		</Field>
	);
}
