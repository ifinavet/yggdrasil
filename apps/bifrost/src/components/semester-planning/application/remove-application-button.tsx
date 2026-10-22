"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRunMutation } from "./model";

/**
 * Removes a deleted («Slettet») application for good, after asking, so it no longer clutters
 * «Fordeling» and «Søknader». Shown only for deleted applications; the backend refuses the rest.
 * A table row around it ignores clicks on the button and in the dialog (see `isRowClick`).
 */
export function RemoveApplicationButton({
	applicationId,
	companyName,
	className,
}: Readonly<{
	applicationId: Id<"companyApplications">;
	companyName: string;
	className?: string;
}>) {
	const remove = useMutation(api.semesterPlanning.applications.mutations.remove);
	const { pending, run } = useRunMutation();
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				size="icon-sm"
				variant="ghost"
				disabled={pending}
				onClick={() => setOpen(true)}
				aria-label={`Fjern søknaden fra ${companyName}`}
				title="Fjern for godt"
				className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
			>
				<Trash2 aria-hidden />
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title={`Fjerne søknaden fra ${companyName} for godt?`}
				description="Søknaden, tilbudene og historikken slettes og kan ikke hentes tilbake."
				confirmLabel="Fjern søknaden"
				destructive
				onConfirm={() =>
					run(
						() => remove({ applicationId }),
						() => toast.success("Søknaden er fjernet."),
					)
				}
			/>
		</>
	);
}
