"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";

type Invoice = FunctionReturnType<typeof api.invoicing.admin.list>[number];

const KIND_LABELS: Record<Invoice["kind"], string> = {
	jobListingOrder: "Stillingsannonser",
	companyApplication: "Bedriftspresentasjon",
};

const STATUS_BADGES: Record<Invoice["status"], { label: string; variant: BadgeVariant }> = {
	scheduled: { label: "Planlagt", variant: "muted" },
	queued: { label: "Sendes", variant: "soft" },
	draft_created: { label: "Utkast i Fiken", variant: "secondary" },
	failed: { label: "Feilet", variant: "destructive" },
	cancelled: { label: "Avbrutt", variant: "outline" },
};

function formatDate(timestamp: number) {
	return formatOsloDate(timestamp, DATE_PATTERNS.numericDate);
}

export function InvoicesTable() {
	const invoices = useQuery(api.invoicing.admin.list, {});
	const retry = useMutation(api.invoicing.admin.retry);
	const [retrying, setRetrying] = useState<Id<"invoices"> | null>(null);

	if (!invoices) return null;
	if (invoices.length === 0) {
		return <p className="text-muted-foreground text-sm">Ingen fakturaer er planlagt ennå.</p>;
	}

	const retryInvoice = async (invoiceId: Id<"invoices">) => {
		setRetrying(invoiceId);
		try {
			await retry({ invoiceId });
			toast.success("Fakturaen sendes til Fiken på nytt.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke prøve fakturaen på nytt."));
		}
		setRetrying(null);
	};

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className={LIST_HEAD}>Bedrift</TableHead>
					<TableHead className={LIST_HEAD}>Gjelder</TableHead>
					<TableHead className={LIST_HEAD}>Levert</TableHead>
					<TableHead className={LIST_HEAD}>Faktureres</TableHead>
					<TableHead className={LIST_HEAD}>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{invoices.map((invoice) => {
					const badge = STATUS_BADGES[invoice.status];
					return (
						<TableRow key={invoice._id}>
							<TableCell className={`${LIST_CELL} font-medium`}>{invoice.companyName}</TableCell>
							<TableCell className={LIST_CELL}>{KIND_LABELS[invoice.kind]}</TableCell>
							<TableCell className={LIST_CELL}>{formatDate(invoice.serviceAt)}</TableCell>
							<TableCell className={LIST_CELL}>{formatDate(invoice.dueAt)}</TableCell>
							<TableCell className={`${LIST_CELL} whitespace-normal`}>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant={badge.variant}>
										{invoice.fikenDraftId ? `${badge.label} #${invoice.fikenDraftId}` : badge.label}
									</Badge>
									{invoice.status === "failed" && (
										<Button
											size="sm"
											variant="outline"
											disabled={retrying === invoice._id}
											onClick={() => retryInvoice(invoice._id)}
										>
											Prøv igjen
										</Button>
									)}
								</div>
								{invoice.lastError && invoice.status !== "draft_created" && (
									<p className="mt-1 max-w-md text-muted-foreground text-xs">{invoice.lastError}</p>
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
