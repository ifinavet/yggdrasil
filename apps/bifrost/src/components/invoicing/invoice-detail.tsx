"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { formatNokFromOre } from "@workspace/shared/products";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { CancelInvoiceButton } from "./cancel-invoice-button";
import { formatInvoiceDate, KIND_LABELS } from "./invoice-labels";
import { InvoiceNextStep } from "./invoice-next-step";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoicingBreadcrumb } from "./invoicing-breadcrumb";
import { RetryInvoiceButton } from "./retry-invoice-button";

type Preview = NonNullable<FunctionReturnType<typeof api.invoicing.admin.get>>["preview"];

function Detail({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="whitespace-pre-line">{children}</dd>
		</>
	);
}

function PreviewDetails({ preview }: Readonly<{ preview: Preview }>) {
	if (!preview) return null;
	switch (preview.kind) {
		case "ready": {
			const { customer, invoiceText, yourReference, line } = preview.plan;
			return (
				<>
					<Detail label="Kunde">{`${customer.name}, org.nr. ${customer.organizationNumber}`}</Detail>
					{customer.email && <Detail label="Faktura-e-post">{customer.email}</Detail>}
					<Detail label="Fakturatekst">{invoiceText}</Detail>
					{yourReference && <Detail label="Deres referanse">{yourReference}</Detail>}
					<Detail label="Linje">{line.description}</Detail>
					<Detail label="Beløp eks. mva">{formatNokFromOre(line.unitPrice)}</Detail>
					<Detail label="Mva">{`${line.vatRate} %`}</Detail>
				</>
			);
		}
		case "cancel":
			return (
				<Detail label="Til Fiken">
					Bestillingen eller søknaden er ikke lenger aktiv, så fakturaen avbrytes i stedet for å
					sendes.
				</Detail>
			);
		case "reschedule":
			return (
				<Detail label="Til Fiken">
					{`Arrangementet er flyttet, så fakturaen flyttes til ${formatInvoiceDate(preview.serviceAt)} før den sendes.`}
				</Detail>
			);
		case "fail":
			return <Detail label="Til Fiken">{preview.error}</Detail>;
	}
}

export function InvoiceDetail({ id }: Readonly<{ id: Id<"invoices"> }>) {
	const data = useQuery(api.invoicing.admin.get, { invoiceId: id });

	if (data === undefined) return null;
	if (data === null) return <p className="text-muted-foreground">Fant ikke fakturaen.</p>;
	const { invoice, attempts, draftCreatedAt, preview } = data;
	const cancellable = invoice.status === "scheduled" || invoice.status === "failed";

	return (
		<>
			<InvoicingBreadcrumb current={invoice.companyName} />
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-[22px]">{invoice.companyName}</h1>
				<InvoiceStatusBadge invoice={invoice} />
				<div className="ml-auto flex gap-2">
					{invoice.status === "failed" && <RetryInvoiceButton invoiceId={invoice._id} />}
					{cancellable && <CancelInvoiceButton invoiceId={invoice._id} />}
				</div>
			</div>
			<Panel className="max-w-3xl">
				<PanelBody>
					<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
						<Detail label="Neste steg">
							<InvoiceNextStep status={invoice.status} />
						</Detail>
						<Detail label="Gjelder">{KIND_LABELS[invoice.kind]}</Detail>
						<Detail label="Levert">{formatInvoiceDate(invoice.serviceAt)}</Detail>
						{draftCreatedAt && (
							<Detail label="Utkast laget">{formatInvoiceDate(draftCreatedAt)}</Detail>
						)}
						{!draftCreatedAt && invoice.status !== "cancelled" && (
							<Detail label="Faktureres">{formatInvoiceDate(invoice.dueAt)}</Detail>
						)}
						<PreviewDetails preview={preview} />
						{attempts > 0 && <Detail label="Forsøk">{attempts}</Detail>}
						{invoice.lastError && invoice.status !== "draft_created" && (
							<Detail label="Siste feil">{invoice.lastError}</Detail>
						)}
					</dl>
				</PanelBody>
			</Panel>
		</>
	);
}
