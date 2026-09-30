"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { formatNokFromOre } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CancelInvoiceButton } from "./cancel-invoice-button";
import { formatInvoiceDate, KIND_LABELS } from "./invoice-labels";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoicingBreadcrumb } from "./invoicing-breadcrumb";
import { MarkSentButton, MarkUnsentButton } from "./mark-sent-button";

type InvoiceDetails = NonNullable<FunctionReturnType<typeof api.invoicing.admin.get>>;
type ReadyPreview = Extract<InvoiceDetails["preview"], { kind: "ready" }>;

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success("Kopiert");
	} catch {
		toast.error("Kunne ikke kopiere. Merk og kopier teksten manuelt.");
	}
}

function CopyField({
	label,
	value,
	copyValue = value,
}: Readonly<{ label: string; value: string; copyValue?: string }>) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-3 last:border-b-0">
			<div className="min-w-0">
				<dt className="text-muted-foreground text-xs">{label}</dt>
				<dd className="mt-0.5 whitespace-pre-wrap break-words font-medium text-sm">{value}</dd>
			</div>
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={`Kopier ${label.toLowerCase()}`}
				title={`Kopier ${label.toLowerCase()}`}
				onClick={() => void copy(copyValue)}
			>
				<Copy className="size-4" />
			</Button>
		</div>
	);
}

function InvoiceFields({ preview }: Readonly<{ preview: ReadyPreview }>) {
	const { customer, invoiceText, yourReference, line } = preview.details;
	const allFields = [
		`Kunde: ${customer.name}`,
		`Organisasjonsnummer: ${customer.organizationNumber}`,
		customer.email && `Faktura-e-post: ${customer.email}`,
		customer.billingDetails && `Fakturadetaljer: ${customer.billingDetails}`,
		`EHF: ${customer.ehfInvoice ? "Ja" : "Nei"}`,
		yourReference && `Deres referanse: ${yourReference}`,
		`Fakturatekst: ${invoiceText}`,
		`Fakturalinje: ${line.description}`,
		`Beløp eks. mva: ${String(line.unitPrice / 100).replace(".", ",")}`,
		`Mva: ${line.vatRate} %`,
	]
		.filter(Boolean)
		.join("\n");

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-base">Opplysninger til Fiken</h2>
				<div className="flex flex-wrap gap-2">
					<Button size="sm" variant="outline" onClick={() => void copy(allFields)}>
						<Copy className="size-4" />
						Kopier alt
					</Button>
					<Button asChild size="sm" variant="outline">
						<a href="https://fiken.no" target="_blank" rel="noopener noreferrer">
							Åpne Fiken <ExternalLink className="size-4" />
						</a>
					</Button>
				</div>
			</div>
			<div className="grid items-start gap-4 lg:grid-cols-2">
				<Panel>
					<PanelBody>
						<h3 className="mb-2 font-semibold text-sm">Kunde</h3>
						<dl>
							<CopyField label="Navn" value={customer.name} />
							<CopyField label="Organisasjonsnummer" value={customer.organizationNumber} />
							{customer.email && <CopyField label="Faktura-e-post" value={customer.email} />}
							{customer.billingDetails && (
								<CopyField label="Fakturadetaljer" value={customer.billingDetails} />
							)}
							<CopyField label="EHF" value={customer.ehfInvoice ? "Ja" : "Nei"} />
							{yourReference && <CopyField label="Deres referanse" value={yourReference} />}
						</dl>
					</PanelBody>
				</Panel>
				<Panel>
					<PanelBody>
						<h3 className="mb-2 font-semibold text-sm">Faktura</h3>
						<dl>
							<CopyField label="Fakturatekst" value={invoiceText} />
							<CopyField label="Fakturalinje" value={line.description} />
							<CopyField
								label="Beløp eks. mva"
								value={formatNokFromOre(line.unitPrice)}
								copyValue={String(line.unitPrice / 100).replace(".", ",")}
							/>
							<CopyField label="Mva" value={`${line.vatRate} %`} copyValue={String(line.vatRate)} />
						</dl>
					</PanelBody>
				</Panel>
			</div>
		</div>
	);
}

export function InvoiceDetail({ id }: Readonly<{ id: Id<"invoices"> }>) {
	const data = useQuery(api.invoicing.admin.get, { invoiceId: id });
	if (data === undefined)
		return <p className="text-muted-foreground text-sm">Laster fakturagrunnlag...</p>;
	if (data === null) return <p className="text-muted-foreground">Fant ikke fakturaen.</p>;
	const { invoice, preview } = data;
	const ready = preview.kind === "ready";
	const delivered = invoice.serviceAt <= Date.now();

	return (
		<>
			<InvoicingBreadcrumb current={invoice.companyName} />
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="font-semibold text-2xl tracking-tight">{invoice.companyName}</h1>
						<InvoiceStatusBadge invoice={invoice} />
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{invoice.invoiceText ?? KIND_LABELS[invoice.kind]} · {delivered ? "Levert" : "Planlagt"}{" "}
						{formatInvoiceDate(invoice.serviceAt)}
					</p>
				</div>
				{invoice.status === "pending" && ready && delivered && (
					<MarkSentButton invoiceId={invoice._id} />
				)}
				{invoice.status === "sent" && <MarkUnsentButton invoiceId={invoice._id} />}
			</div>
			<div className="max-w-5xl space-y-5">
				{invoice.status === "sent" ? (
					<Callout tone="neutral">
						Merket som sendt {invoice.sentAt && formatInvoiceDate(invoice.sentAt)}. Opplysningene
						nedenfor viser grunnlaget som ble brukt da fakturaen ble merket som sendt.
					</Callout>
				) : invoice.status === "cancelled" ? (
					<Callout tone="neutral">Dette grunnlaget er avbrutt og skal ikke faktureres.</Callout>
				) : !ready ? (
					<Callout tone="danger">
						{preview.kind === "fail" ? preview.error : "Grunnlaget er ikke lenger aktivt."}{" "}
						Kontroller grunnlaget før fakturering.
					</Callout>
				) : !delivered ? (
					<Callout tone="neutral">
						Leveransen er planlagt {formatInvoiceDate(invoice.serviceAt)}. Den kan merkes som sendt
						etter at den er gjennomført.
					</Callout>
				) : (
					<Callout tone="info">
						Opprett og send fakturaen i Fiken. Marker den som sendt her når du er ferdig.
					</Callout>
				)}
				{ready && <InvoiceFields preview={preview} />}
				{invoice.status === "pending" && (
					<div className="pt-2">
						<CancelInvoiceButton invoiceId={invoice._id} />
					</div>
				)}
			</div>
		</>
	);
}
