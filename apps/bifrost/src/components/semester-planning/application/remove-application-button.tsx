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
 * Clicks stay inside, so a table row around it does not open the application.
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
		// biome-ignore lint/a11y/noStaticElementInteractions: only stops clicks reaching the row
		// biome-ignore lint/a11y/useKeyWithClickEvents: the button and dialog handle the keyboard
		<span className={cn("inline-flex", className)} onClick={(event) => event.stopPropagation()}>
			<Button
				size="icon-sm"
				variant="ghost"
				disabled={pending}
				onClick={() => setOpen(true)}
				aria-label={`Fjern søknaden fra ${companyName}`}
				title="Fjern for godt"
				className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
		</span>
	);
}
