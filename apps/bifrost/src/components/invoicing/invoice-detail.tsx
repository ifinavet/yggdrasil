"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { formatNokFromOre } from "@workspace/shared/products";
import { Callout } from "@workspace/ui/components/products/callout";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { CancelInvoiceButton } from "./cancel-invoice-button";
import { formatInvoiceDate, KIND_LABELS, NEXT_STEPS } from "./invoice-labels";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoicingBreadcrumb } from "./invoicing-breadcrumb";
import { OpenInFikenLink } from "./open-in-fiken-link";
import { RetryInvoiceButton } from "./retry-invoice-button";

type InvoiceDetails = NonNullable<FunctionReturnType<typeof api.invoicing.admin.get>>;
type Preview = InvoiceDetails["preview"];

function Detail({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="whitespace-pre-line">{children}</dd>
		</>
	);
}

function DetailPanel({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<Panel>
			<PanelBody>
				<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">{children}</dl>
			</PanelBody>
		</Panel>
	);
}

function PreviewPanels({ preview }: Readonly<{ preview: Preview }>) {
	if (!preview) return null;
	switch (preview.kind) {
		case "ready": {
			const { customer, invoiceText, yourReference, line } = preview.plan;
			return (
				<>
					<DetailPanel>
						<Detail label="Kunde">{customer.name}</Detail>
						<Detail label="Org.nr.">{customer.organizationNumber}</Detail>
						{customer.email && <Detail label="Faktura-e-post">{customer.email}</Detail>}
						{yourReference && <Detail label="Deres referanse">{yourReference}</Detail>}
					</DetailPanel>
					<DetailPanel>
						<Detail label="Fakturatekst">{invoiceText}</Detail>
						<Detail label="Linje">{line.description}</Detail>
						<Detail label="Beløp eks. mva">{formatNokFromOre(line.unitPrice)}</Detail>
						<Detail label="Mva">{`${line.vatRate} %`}</Detail>
					</DetailPanel>
				</>
			);
		}
		case "cancel":
			return (
				<DetailPanel>
					<Detail label="Til Fiken">
						Bestillingen eller søknaden er ikke lenger aktiv, så fakturaen avbrytes i stedet for å
						sendes.
					</Detail>
				</DetailPanel>
			);
		case "reschedule":
			return (
				<DetailPanel>
					<Detail label="Til Fiken">
						{`Arrangementet er flyttet, så fakturaen flyttes til ${formatInvoiceDate(preview.serviceAt)} før den sendes.`}
					</Detail>
				</DetailPanel>
			);
		case "fail":
			return (
				<DetailPanel>
					<Detail label="Til Fiken">{preview.error}</Detail>
				</DetailPanel>
			);
	}
}

function NextStepPanel({ invoice }: Readonly<{ invoice: InvoiceDetails["invoice"] }>) {
	const cancellable = invoice.status === "scheduled" || invoice.status === "failed";
	const showError = invoice.lastError && invoice.status !== "draft_created";
	const step = NEXT_STEPS[invoice.status];
	return (
		<Callout
			tone={step.tone}
			className="mb-4 text-sm"
			action={
				(invoice.status === "failed" || invoice.status === "draft_created" || cancellable) && (
					<>
						{invoice.status === "draft_created" && <OpenInFikenLink />}
						{invoice.status === "failed" && <RetryInvoiceButton invoiceId={invoice._id} />}
						{cancellable && <CancelInvoiceButton invoiceId={invoice._id} />}
					</>
				)
			}
		>
			<p className="font-medium">{step.label}</p>
			{showError && <p className="mt-1 opacity-85">{invoice.lastError}</p>}
		</Callout>
	);
}

export function InvoiceDetail({ id }: Readonly<{ id: Id<"invoices"> }>) {
	const data = useQuery(api.invoicing.admin.get, { invoiceId: id });

	if (data === undefined) return null;
	if (data === null) return <p className="text-muted-foreground">Fant ikke fakturaen.</p>;
	const { invoice, attempts, draftCreatedAt, preview } = data;

	return (
		<>
			<InvoicingBreadcrumb current={invoice.companyName} />
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-[22px]">{invoice.companyName}</h1>
				<InvoiceStatusBadge invoice={invoice} />
			</div>
			<div className="max-w-5xl">
				<NextStepPanel invoice={invoice} />
				<div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
					<div className="grid gap-4">
						<PreviewPanels preview={preview} />
					</div>
					<DetailPanel>
						<Detail label="Gjelder">{KIND_LABELS[invoice.kind]}</Detail>
						<Detail label="Levert">{formatInvoiceDate(invoice.serviceAt)}</Detail>
						{draftCreatedAt && (
							<Detail label="Utkast laget">{formatInvoiceDate(draftCreatedAt)}</Detail>
						)}
						{!draftCreatedAt && invoice.status !== "cancelled" && (
							<Detail label="Faktureres">{formatInvoiceDate(invoice.dueAt)}</Detail>
						)}
						{attempts > 0 && <Detail label="Forsøk">{attempts}</Detail>}
					</DetailPanel>
				</div>
			</div>
		</>
	);
}
