"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { LISTING_COLORS } from "@workspace/shared/constants";
import type { JobListingOrderSettings } from "@workspace/shared/job-listing-orders";
import { formatNok } from "@workspace/shared/products";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import SafeHtml from "@/components/common/sanitize-html";
import { OrderItemEditor } from "./order-item-editor";
import {
	approveBlocker,
	type CompanyChangeRow,
	companyChangeRows,
	formatBilling,
	formatDeadline,
} from "./order-review";

type Order = NonNullable<FunctionReturnType<typeof api.jobListingOrders.admin.getOrder>>;
type OrderItem = Order["items"][number];
type CompanyUpdate = NonNullable<Order["update"]>;

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ConvexError ? String(error.data) : fallback;
}

export function OrderReviewDialog({
	orderId,
	onClose,
}: Readonly<{ orderId: Id<"jobListingOrders"> | undefined; onClose: () => void }>) {
	return (
		<Dialog open={orderId !== undefined} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
				{orderId && <OrderReviewContent orderId={orderId} onClose={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function OrderReviewContent({
	orderId,
	onClose,
}: Readonly<{ orderId: Id<"jobListingOrders">; onClose: () => void }>) {
	const order = useQuery(api.jobListingOrders.admin.getOrder, { orderId });
	const settings = useQuery(api.jobListingOrders.settings.current, {});

	if (order === undefined || settings === undefined) {
		return (
			<DialogHeader>
				<DialogTitle>Bestilling</DialogTitle>
				<DialogDescription>Henter bestillingen …</DialogDescription>
			</DialogHeader>
		);
	}
	if (order === null) {
		return (
			<DialogHeader>
				<DialogTitle>Bestilling</DialogTitle>
				<DialogDescription>Fant ikke bestillingen.</DialogDescription>
			</DialogHeader>
		);
	}
	return <OrderReview order={order} settings={settings} onClose={onClose} />;
}

function OrderReview({
	order,
	settings,
	onClose,
}: Readonly<{ order: Order; settings: JobListingOrderSettings; onClose: () => void }>) {
	const companyName = order.company?.name ?? order.reference;
	const billing = order.billing ?? order.company?.billing;

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex flex-wrap items-center gap-2">
					{companyName}
					{order.isNewCompany && <Badge variant="secondary">Ny bedrift</Badge>}
				</DialogTitle>
				<DialogDescription>
					{order.reference}, {order.productName}
				</DialogDescription>
			</DialogHeader>

			<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
				<Detail label="Kontaktperson">
					{[order.contact.name, order.contact.email, order.contact.phone]
						.filter(Boolean)
						.join(", ")}
				</Detail>
				{billing && <Detail label="Faktura">{formatBilling(billing)}</Detail>}
				{order.company && order.isNewCompany && (
					<Detail label="Organisasjonsnummer">
						{[order.company.orgNumber, order.company.registryName].filter(Boolean).join(", ")}
					</Detail>
				)}
				<Detail label="Antall annonser">{order.quantity}</Detail>
				<Detail label="Pris">{formatNok(order.priceOre)}</Detail>
				{order.note && <Detail label="Kommentar">{order.note}</Detail>}
				{order.feedback && <Detail label="Tilbakemelding">{order.feedback}</Detail>}
			</dl>

			{order.update && <CompanyUpdateReview update={order.update} />}

			<ul className="flex flex-col gap-4">
				{order.items.map((item) => (
					<li key={item._id}>
						<OrderItemReview
							item={item}
							settings={settings}
							companyName={companyName}
							logoUrl={order.company?.logoUrl ?? null}
							editable={order.status === "confirmed"}
						/>
					</li>
				))}
			</ul>

			{order.status === "confirmed" && <OrderDecision order={order} onClose={onClose} />}
		</>
	);
}

function Detail({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="whitespace-pre-line">{children}</dd>
		</>
	);
}

const UPDATE_STATUS_LABELS = {
	approved: "Endring godkjent",
	rejected: "Endring avvist",
} as const;

function CompanyUpdateReview({ update }: Readonly<{ update: CompanyUpdate }>) {
	const decideUpdate = useMutation(api.jobListingOrders.admin.decideUpdate);
	const [deciding, setDeciding] = useState(false);

	async function decide(approve: boolean) {
		setDeciding(true);
		try {
			await decideUpdate({ requestId: update._id, approve });
			toast.success(approve ? "Endringen er godkjent" : "Endringen er avvist");
		} catch (error) {
			toast.error(errorMessage(error, "Kunne ikke behandle endringen."));
		} finally {
			setDeciding(false);
		}
	}

	return (
		<div className="flex flex-col gap-4 rounded-lg border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-medium text-sm">Endring i bedriftsinformasjonen</p>
				{update.status === "pending" ? (
					<Badge variant="outline">Endring venter</Badge>
				) : (
					<Badge variant="muted">{UPDATE_STATUS_LABELS[update.status]}</Badge>
				)}
			</div>
			<div className="grid grid-cols-[max-content_1fr_1fr] gap-x-6 gap-y-4 text-sm">
				<span />
				<span className="text-muted-foreground">Før</span>
				<span className="text-muted-foreground">Etter</span>
				{companyChangeRows(update).map((row) => (
					<ChangeRow key={row.key} row={row} />
				))}
			</div>
			{update.status === "pending" && (
				<div className="flex justify-end gap-2">
					<Button variant="outline" disabled={deciding} onClick={() => void decide(false)}>
						Avvis endring
					</Button>
					<Button disabled={deciding} onClick={() => void decide(true)}>
						Godkjenn endring
					</Button>
				</div>
			)}
		</div>
	);
}

function ChangeRow({ row }: Readonly<{ row: CompanyChangeRow }>) {
	return (
		<>
			<span className="font-medium">{row.label}</span>
			<div className="min-w-0 text-muted-foreground">
				<ChangeValue row={row} value={row.before} />
			</div>
			<div className="min-w-0">
				<ChangeValue row={row} value={row.after} />
			</div>
		</>
	);
}

function ChangeValue({
	row,
	value,
}: Readonly<{ row: CompanyChangeRow; value: CompanyChangeRow["after"] }>) {
	if (value === undefined || value === null) return <span>Ikke satt</span>;
	if (typeof value === "object") return <span>{formatBilling(value)}</span>;
	if (row.key === "logoUrl") return <CompanyLogo name={row.label} url={value} size="lg" />;
	if (row.key === "description") return <SafeHtml html={value} className="prose prose-sm" />;
	return <span>{value}</span>;
}

function OrderItemReview({
	item,
	settings,
	companyName,
	logoUrl,
	editable,
}: Readonly<{
	item: OrderItem;
	settings: JobListingOrderSettings;
	companyName: string;
	logoUrl: string | null;
	editable: boolean;
}>) {
	const [editing, setEditing] = useState(false);
	const { _id, position: _position, ...listing } = item;

	if (editing) {
		return (
			<div className="rounded-lg border p-4">
				<OrderItemEditor
					itemId={_id}
					listing={listing}
					settings={settings}
					onDone={() => setEditing(false)}
				/>
			</div>
		);
	}

	return (
		<article className="overflow-hidden rounded-lg border">
			<div
				className={cn(
					"px-4 py-2 font-semibold text-primary-foreground text-sm",
					LISTING_COLORS[item.type] ?? "bg-gray-400",
				)}
			>
				{item.type}
			</div>
			<div className="flex flex-col gap-4 p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						<CompanyLogo name={companyName} url={logoUrl} size="lg" />
						<div className="flex flex-col">
							<span className="font-semibold text-lg text-primary">{item.title}</span>
							<span className="text-muted-foreground text-sm">{companyName}</span>
						</div>
					</div>
					{editable && (
						<Button variant="outline" size="sm" onClick={() => setEditing(true)}>
							Rediger
						</Button>
					)}
				</div>
				<p>{item.teaser}</p>
				<p className="text-sm">
					<span className="text-muted-foreground">Søknadsfrist: </span>
					{formatDeadline(item.deadline)}
				</p>
				<SafeHtml html={item.description} className="prose prose-sm dark:prose-invert max-w-none" />
				<a
					href={item.applicationUrl}
					target="_blank"
					rel="noreferrer"
					className="break-all text-primary text-sm underline"
				>
					{item.applicationUrl}
				</a>
			</div>
		</article>
	);
}

function OrderDecision({ order, onClose }: Readonly<{ order: Order; onClose: () => void }>) {
	const router = useRouter();
	const approve = useMutation(api.jobListingOrders.admin.approve);
	const reject = useMutation(api.jobListingOrders.admin.reject);
	const [rejecting, setRejecting] = useState(false);
	const [reason, setReason] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const blocker = approveBlocker(order.update);

	async function run(action: () => Promise<unknown>, success: string, fallback: string) {
		setSubmitting(true);
		try {
			await action();
			toast.success(success);
			onClose();
			router.refresh();
		} catch (error) {
			toast.error(errorMessage(error, fallback));
		} finally {
			setSubmitting(false);
		}
	}

	if (rejecting) {
		return (
			<div className="flex flex-col gap-3">
				<Label htmlFor="rejection-reason">Begrunnelse</Label>
				<Textarea
					id="rejection-reason"
					rows={4}
					maxLength={1000}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<DialogFooter>
					<Button variant="outline" disabled={submitting} onClick={() => setRejecting(false)}>
						Avbryt
					</Button>
					<Button
						variant="destructive"
						disabled={submitting || !reason.trim()}
						onClick={() =>
							void run(
								() => reject({ orderId: order._id, reason }),
								"Bestillingen er avvist",
								"Kunne ikke avvise bestillingen.",
							)
						}
					>
						Avvis bestillingen
					</Button>
				</DialogFooter>
			</div>
		);
	}

	return (
		<DialogFooter className="items-center">
			{blocker && <p className="mr-auto text-muted-foreground text-sm">{blocker}</p>}
			<Button variant="outline" disabled={submitting} onClick={() => setRejecting(true)}>
				Avvis
			</Button>
			<Button
				disabled={submitting || blocker !== undefined}
				onClick={() =>
					void run(
						() => approve({ orderId: order._id }),
						"Annonsene er publisert",
						"Kunne ikke publisere annonsene.",
					)
				}
			>
				Godkjenn og publiser
			</Button>
		</DialogFooter>
	);
}
