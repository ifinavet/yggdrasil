"use client";

import { api } from "@workspace/backend/convex/api";
import { formatNokFromOre } from "@workspace/shared/products";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import Link from "next/link";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import {
	formatInvoiceDate,
	groupInvoices,
	INVOICE_GROUPS,
	type InvoiceGroup,
	type InvoiceSummary,
	KIND_LABELS,
} from "./invoice-labels";
import { InvoiceNextStep } from "./invoice-next-step";
import { INVOICE_ROUTES } from "./invoice-routes";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { OpenInFikenLink } from "./open-in-fiken-link";
import { RetryInvoiceButton } from "./retry-invoice-button";

const GROUP_ORDER = Object.keys(INVOICE_GROUPS) as InvoiceGroup[];

export function InvoicesTable() {
	const invoices = useQuery(api.invoicing.admin.list, {});

	if (!invoices) return null;
	if (invoices.length === 0) {
		return <p className="text-muted-foreground text-sm">Ingen fakturaer er planlagt ennå.</p>;
	}

	const groups = groupInvoices(invoices);
	return (
		<Tabs defaultValue={groups.failed.length > 0 ? "failed" : "upcoming"}>
			<TabsList>
				{GROUP_ORDER.map((group) => (
					<TabsTrigger key={group} value={group} className="gap-1.5">
						{INVOICE_GROUPS[group].label}
						<span
							className={cn(
								"rounded-full px-1.5 text-xs tabular-nums",
								group === "failed" && groups.failed.length > 0
									? "bg-destructive/10 text-destructive"
									: "bg-muted text-muted-foreground",
							)}
						>
							{groups[group].length}
						</span>
					</TabsTrigger>
				))}
			</TabsList>
			{GROUP_ORDER.map((group) => (
				<TabsContent key={group} value={group} className="mt-4">
					{groups[group].length === 0 ? (
						<p className="text-muted-foreground text-sm">Ingen fakturaer her.</p>
					) : (
						<InvoiceRows invoices={groups[group]} />
					)}
				</TabsContent>
			))}
		</Tabs>
	);
}

function InvoiceRows({ invoices }: Readonly<{ invoices: InvoiceSummary[] }>) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className={LIST_HEAD}>Bedrift</TableHead>
					<TableHead className={LIST_HEAD}>Gjelder</TableHead>
					<TableHead className={LIST_HEAD}>Levert</TableHead>
					<TableHead className={LIST_HEAD}>Faktureres</TableHead>
					<TableHead className={LIST_HEAD}>Beløp eks. mva</TableHead>
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
						<TableCell className={`${LIST_CELL} tabular-nums`}>
							{invoice.amountOre === undefined ? "" : formatNokFromOre(invoice.amountOre)}
						</TableCell>
						<TableCell className={`${LIST_CELL} whitespace-normal`}>
							<div className="flex flex-wrap items-center gap-2">
								<InvoiceStatusBadge invoice={invoice} />
								{invoice.status === "failed" && <RetryInvoiceButton invoiceId={invoice._id} />}
								{invoice.status === "draft_created" && <OpenInFikenLink />}
							</div>
							{invoice.lastError && invoice.status !== "draft_created" && (
								<p className="mt-1 max-w-md text-muted-foreground text-xs">{invoice.lastError}</p>
							)}
							<InvoiceNextStep status={invoice.status} className="mt-1 max-w-md text-xs" />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
