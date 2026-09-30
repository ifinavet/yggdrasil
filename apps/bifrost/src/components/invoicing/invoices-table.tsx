"use client";

import { api } from "@workspace/backend/convex/api";
import { formatNokFromOre } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import {
	formatInvoiceDate,
	groupPending,
	type InvoiceSummary,
	KIND_LABELS,
} from "./invoice-labels";
import { INVOICE_ROUTES } from "./invoice-routes";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { MarkSentButton } from "./mark-sent-button";

type InvoicePage = ReturnType<typeof usePaginatedQuery<typeof api.invoicing.admin.list>>;

function EmptyList({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
			{children}
		</p>
	);
}

function LoadMore({ page }: Readonly<{ page: InvoicePage }>) {
	if (page.status === "Exhausted" || page.isLoading) return null;
	return (
		<Button className="mt-4" variant="outline" onClick={() => page.loadMore(30)}>
			Vis flere
		</Button>
	);
}

export function InvoicesTable() {
	const pending = usePaginatedQuery(
		api.invoicing.admin.list,
		{ status: "pending" },
		{ initialNumItems: 30 },
	);
	const sent = usePaginatedQuery(
		api.invoicing.admin.list,
		{ status: "sent" },
		{ initialNumItems: 30 },
	);
	const cancelled = usePaginatedQuery(
		api.invoicing.admin.list,
		{ status: "cancelled" },
		{ initialNumItems: 30 },
	);
	const groups = groupPending(pending.results);

	return (
		<div className="flex flex-col gap-5">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Fakturaer</h1>
			</div>
			{process.env.NEXT_PUBLIC_LOCAL_DEV === "true" && (
				<p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
					Lokale eksempeldata · ingen Fiken-kobling
				</p>
			)}
			<Tabs defaultValue="pending">
				<TabsList>
					<TabsTrigger value="pending">Til fakturering</TabsTrigger>
					<TabsTrigger value="sent">Sendt</TabsTrigger>
					<TabsTrigger value="cancelled">Avbrutt</TabsTrigger>
				</TabsList>
				<TabsContent value="pending" className="mt-5 space-y-6">
					{pending.isLoading ? (
						<p className="text-muted-foreground text-sm">Laster fakturagrunnlag...</p>
					) : (
						<>
							<section className="space-y-3" aria-labelledby="ready-invoices-heading">
								<h2
									id="ready-invoices-heading"
									className="rounded-md bg-primary-light px-4 py-3 font-semibold text-base"
								>
									Klar nå
								</h2>
								{groups.ready.length ? (
									<InvoiceRows invoices={groups.ready} />
								) : (
									<EmptyList>Ingen leveranser klare til fakturering.</EmptyList>
								)}
							</section>
							{groups.blocked.length > 0 && (
								<section
									className="space-y-3 border-t pt-6"
									aria-labelledby="blocked-invoices-heading"
								>
									<h2 id="blocked-invoices-heading" className="font-semibold text-base">
										Trenger opplysninger
									</h2>
									<InvoiceRows invoices={groups.blocked} />
								</section>
							)}
							<section
								className="space-y-3 border-t pt-6"
								aria-labelledby="upcoming-invoices-heading"
							>
								<h2
									id="upcoming-invoices-heading"
									className="font-semibold text-base text-muted-foreground"
								>
									Kommende
								</h2>
								{groups.upcoming.length ? (
									<InvoiceRows invoices={groups.upcoming} />
								) : (
									<EmptyList>Ingen kommende leveranser.</EmptyList>
								)}
							</section>
							<LoadMore page={pending} />
						</>
					)}
				</TabsContent>
				<TabsContent value="sent" className="mt-5 space-y-3">
					{sent.isLoading ? (
						<p className="text-muted-foreground text-sm">Laster sendte fakturaer...</p>
					) : sent.results.length ? (
						<InvoiceRows invoices={sent.results} />
					) : (
						<EmptyList>Ingen fakturaer er merket som sendt.</EmptyList>
					)}
					<LoadMore page={sent} />
				</TabsContent>
				<TabsContent value="cancelled" className="mt-5 space-y-3">
					{cancelled.isLoading ? (
						<p className="text-muted-foreground text-sm">Laster avbrutte fakturaer...</p>
					) : cancelled.results.length ? (
						<InvoiceRows invoices={cancelled.results} />
					) : (
						<EmptyList>Ingen avbrutte fakturaer.</EmptyList>
					)}
					<LoadMore page={cancelled} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function InvoiceRows({ invoices }: Readonly<{ invoices: InvoiceSummary[] }>) {
	const showStatus = invoices[0]?.status !== "pending";
	return (
		<>
			<div className="divide-y rounded-lg border md:hidden">
				{invoices.map((invoice) => (
					<div key={invoice._id} className="space-y-3 p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<Link
									href={INVOICE_ROUTES.detail(invoice._id)}
									className="font-medium text-sm hover:underline focus-visible:underline"
								>
									{invoice.companyName}
								</Link>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{invoice.invoiceText ?? KIND_LABELS[invoice.kind]}
								</p>
							</div>
							<span className="shrink-0 whitespace-nowrap font-medium text-sm tabular-nums">
								{invoice.amountOre === undefined
									? "Mangler pris"
									: formatNokFromOre(invoice.amountOre)}
							</span>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								{showStatus && <InvoiceStatusBadge invoice={invoice} />}
								<span>{formatInvoiceDate(invoice.sentAt ?? invoice.serviceAt)}</span>
							</div>
							{invoice.status === "pending" &&
								invoice.serviceAt <= Date.now() &&
								!invoice.issue && <MarkSentButton invoiceId={invoice._id} />}
						</div>
						{invoice.issue && <p className="text-destructive text-xs">{invoice.issue}</p>}
					</div>
				))}
			</div>
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className={LIST_HEAD}>Bedrift og grunnlag</TableHead>
							<TableHead className={LIST_HEAD}>Levert</TableHead>
							<TableHead className={LIST_HEAD}>Beløp eks. mva</TableHead>
							{showStatus && <TableHead className={LIST_HEAD}>Status</TableHead>}
							<TableHead className={`${LIST_HEAD} text-right`}>Handling</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invoices.map((invoice) => (
							<TableRow key={invoice._id}>
								<TableCell className={LIST_CELL}>
									<Link
										href={INVOICE_ROUTES.detail(invoice._id)}
										className="font-medium text-foreground hover:underline focus-visible:underline"
									>
										{invoice.companyName}
									</Link>
									<p
										className="max-w-sm truncate text-muted-foreground text-xs"
										title={invoice.invoiceText ?? KIND_LABELS[invoice.kind]}
									>
										{invoice.invoiceText ?? KIND_LABELS[invoice.kind]}
									</p>
								</TableCell>
								<TableCell className={`${LIST_CELL} whitespace-nowrap tabular-nums`}>
									{formatInvoiceDate(invoice.serviceAt)}
								</TableCell>
								<TableCell className={`${LIST_CELL} whitespace-nowrap tabular-nums`}>
									{invoice.amountOre === undefined
										? "Mangler pris"
										: formatNokFromOre(invoice.amountOre)}
								</TableCell>
								{showStatus && (
									<TableCell className={LIST_CELL}>
										<InvoiceStatusBadge invoice={invoice} />
										{invoice.issue && (
											<p className="mt-1 max-w-xs text-destructive text-xs">{invoice.issue}</p>
										)}
										{invoice.sentAt && (
											<p className="mt-1 whitespace-nowrap text-muted-foreground text-xs">
												{formatInvoiceDate(invoice.sentAt)}
											</p>
										)}
									</TableCell>
								)}
								<TableCell className={`${LIST_CELL} text-right`}>
									{invoice.status === "pending" &&
										invoice.serviceAt <= Date.now() &&
										!invoice.issue && <MarkSentButton invoiceId={invoice._id} />}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}
