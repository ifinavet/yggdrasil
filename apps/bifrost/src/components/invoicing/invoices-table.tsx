"use client";

import { api } from "@workspace/backend/convex/api";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useQuery } from "convex/react";
import Link from "next/link";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { formatInvoiceDate, KIND_LABELS } from "./invoice-labels";
import { INVOICE_ROUTES } from "./invoice-routes";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { RetryInvoiceButton } from "./retry-invoice-button";

export function InvoicesTable() {
	const invoices = useQuery(api.invoicing.admin.list, {});

	if (!invoices) return null;
	if (invoices.length === 0) {
		return <p className="text-muted-foreground text-sm">Ingen fakturaer er planlagt ennå.</p>;
	}

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
				{invoices.map((invoice) => (
					<TableRow key={invoice._id}>
						<TableCell className={`${LIST_CELL} font-medium`}>
							<Link href={INVOICE_ROUTES.detail(invoice._id)} className="hover:underline">
								{invoice.companyName}
							</Link>
						</TableCell>
						<TableCell className={LIST_CELL}>{KIND_LABELS[invoice.kind]}</TableCell>
						<TableCell className={LIST_CELL}>{formatInvoiceDate(invoice.serviceAt)}</TableCell>
						<TableCell className={LIST_CELL}>{formatInvoiceDate(invoice.dueAt)}</TableCell>
						<TableCell className={`${LIST_CELL} whitespace-normal`}>
							<div className="flex flex-wrap items-center gap-2">
								<InvoiceStatusBadge invoice={invoice} />
								{invoice.status === "failed" && <RetryInvoiceButton invoiceId={invoice._id} />}
							</div>
							{invoice.lastError && invoice.status !== "draft_created" && (
								<p className="mt-1 max-w-md text-muted-foreground text-xs">{invoice.lastError}</p>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
