"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { toast } from "sonner";

export function CancelInvoiceButton({ invoiceId }: Readonly<{ invoiceId: Id<"invoices"> }>) {
	const cancel = useMutation(api.invoicing.admin.cancel);

	const cancelInvoice = async () => {
		try {
			await cancel({ invoiceId });
			toast.success("Fakturaen er avbrutt.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke avbryte fakturaen."));
		}
	};

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button size="sm" variant="outline">
					Avbryt faktura
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Avbryte fakturaen?</AlertDialogTitle>
					<AlertDialogDescription>
						Fakturaen fjernes fra listen over det som skal faktureres. Dette kan ikke angres her.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Behold</AlertDialogCancel>
					<AlertDialogAction onClick={cancelInvoice}>Avbryt faktura</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
