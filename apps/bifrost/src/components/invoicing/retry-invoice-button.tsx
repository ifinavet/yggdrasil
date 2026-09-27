"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export function RetryInvoiceButton({ invoiceId }: Readonly<{ invoiceId: Id<"invoices"> }>) {
	const retry = useMutation(api.invoicing.admin.retry);
	const [retrying, setRetrying] = useState(false);

	const retryInvoice = async () => {
		setRetrying(true);
		try {
			await retry({ invoiceId });
			toast.success("Fakturaen sendes til Fiken på nytt.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke prøve fakturaen på nytt."));
		}
		setRetrying(false);
	};

	return (
		<Button size="sm" variant="outline" disabled={retrying} onClick={retryInvoice}>
			Prøv igjen
		</Button>
	);
}
