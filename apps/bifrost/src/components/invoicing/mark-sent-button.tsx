"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MarkSentButton({ invoiceId }: Readonly<{ invoiceId: Id<"invoices"> }>) {
	const markSent = useMutation(api.invoicing.admin.markSent);
	const markUnsent = useMutation(api.invoicing.admin.markUnsent);
	const [saving, setSaving] = useState(false);

	async function send() {
		setSaving(true);
		try {
			await markSent({ invoiceId });
			toast.success("Merket som sendt", {
				description: "Fakturaen er flyttet til Sendt.",
				action: {
					label: "Angre",
					onClick: () => void markUnsent({ invoiceId }),
				},
			});
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke merke fakturaen som sendt."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Button size="sm" disabled={saving} onClick={send}>
			<Check className="size-4" />
			{saving ? "Lagrer..." : "Marker som sendt"}
		</Button>
	);
}

export function MarkUnsentButton({ invoiceId }: Readonly<{ invoiceId: Id<"invoices"> }>) {
	const markUnsent = useMutation(api.invoicing.admin.markUnsent);
	const [saving, setSaving] = useState(false);

	async function reopen() {
		setSaving(true);
		try {
			await markUnsent({ invoiceId });
			toast.success("Flyttet tilbake til Ikke sendt");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke åpne fakturaen igjen."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Button size="sm" variant="outline" disabled={saving} onClick={reopen}>
			Angre sendt
		</Button>
	);
}
