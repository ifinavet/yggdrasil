import type { AnyFieldApi } from "@tanstack/react-form";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { EVENT_TYPE_LABELS, VENUE_LABELS } from "@workspace/shared/semester/labels";
import { MAX_OFFER_COMMENT_LENGTH } from "@workspace/shared/semester/limits";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { ErrorLine, FOCUS_RING, linkClass, textareaClass } from "@/components/form-controls";
import { fieldErrorText } from "@/components/input-cards/question-block";
import { COMPANY_OFFER_COPY as COPY } from "@/lib/company-offer-copy";
import { offerDayHeading } from "@/lib/company-offer-format";
import type { KnownOffer } from "./company-offer";

export const OFFER_TITLE_CLASS =
	"m-0 font-bold text-[21px] text-primary leading-[1.22] tracking-[-0.015em] outline-none dark:text-primary-foreground";

/** The offered day as a coloured block, with one line under it. */
export function OfferDayCard({
	date,
	note,
	tone = "open",
}: Readonly<{ date: string; note: ReactNode; tone?: "open" | "accepted" | "replaced" }>) {
	return (
		<div
			className={cn(
				"mt-[18px] rounded-[14px] p-[18px]",
				tone === "open" && "bg-primary text-primary-foreground",
				tone === "accepted" &&
					"bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-foreground",
				tone === "replaced" && "bg-muted text-muted-foreground",
			)}
		>
			<p
				className={cn(
					"m-0 font-bold text-[22px] tabular-nums leading-tight tracking-[-0.015em]",
					tone === "replaced" && "line-through",
				)}
			>
				{offerDayHeading(date)}
			</p>
			<p
				className={cn(
					"m-0 mt-[3px] text-[13.5px]",
					tone === "open" ? "text-[oklch(0.88_0.02_274)]" : "text-muted-foreground",
				)}
			>
				{note}
			</p>
		</div>
	);
}

/** Type, students, venue and terms, as the offer email listed them. */
export function OfferFacts({ offer }: Readonly<{ offer: KnownOffer }>) {
	const { facts } = COPY;
	return (
		<dl className="m-0 mt-3 rounded-[14px] border border-border bg-card px-4 py-1">
			<Fact label={facts.type}>{EVENT_TYPE_LABELS[offer.eventType]}</Fact>
			<Fact label={facts.students}>{facts.upTo(offer.maxStudents)}</Fact>
			<Fact label={facts.venue}>{VENUE_LABELS[offer.venue]}</Fact>
			{offer.termsUrl && (
				<Fact label={facts.terms}>
					<a
						href={offer.termsUrl}
						target="_blank"
						rel="noreferrer"
						className={cn(linkClass, "whitespace-nowrap font-semibold text-[13.5px]")}
					>
						{facts.termsLink}
					</a>
				</Fact>
			)}
		</dl>
	);
}

function Fact({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<div className="flex justify-between gap-3 border-border border-t py-[11px] text-[14px] first:border-t-0">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="m-0 min-w-0 text-right">{children}</dd>
		</div>
	);
}

export function ContactLink() {
	return (
		<a href={`mailto:${COMPANY_CONTACT_EMAIL}`} className="underline underline-offset-[3px]">
			{COMPANY_CONTACT_EMAIL}
		</a>
	);
}

/**
 * The top of an answer step: a way back to the offer, the heading and a short lede. The step
 * replaces the offer in place, so focus (and the view) moves to its heading.
 */
export function StepHeader({
	title,
	onBack,
	children,
}: Readonly<{ title: string; onBack: () => void; children: ReactNode }>) {
	const heading = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		heading.current?.focus();
	}, []);

	return (
		<>
			<button
				type="button"
				onClick={onBack}
				className={cn(
					"mt-3 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 font-semibold text-[14px] text-primary dark:text-primary-foreground",
					FOCUS_RING,
					"focus-visible:outline-offset-0",
				)}
			>
				<ChevronLeft className="size-4" aria-hidden />
				{COPY.back}
			</button>
			<h1 ref={heading} tabIndex={-1} className={cn(OFFER_TITLE_CLASS, "mt-2")}>
				{title}
			</h1>
			<p className="m-0 mt-2 text-[14.5px] leading-normal">{children}</p>
		</>
	);
}

/** The optional comment box on the answer steps. */
export function CommentField({
	field,
	id,
	label,
}: Readonly<{ field: AnyFieldApi; id: string; label: string }>) {
	const error = fieldErrorText(field);
	const errorId = `${id}-error`;

	return (
		<div className="mt-[22px]">
			<label htmlFor={id} className="mb-2.5 block font-semibold text-[15px] leading-[1.35]">
				{label}{" "}
				<span className="font-normal text-[13px] text-muted-foreground">{COPY.optional}</span>
			</label>
			<textarea
				id={id}
				value={field.state.value}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.target.value)}
				maxLength={MAX_OFFER_COMMENT_LENGTH}
				aria-invalid={Boolean(error) || undefined}
				aria-describedby={error ? errorId : undefined}
				className={cn(textareaClass(Boolean(error)), "min-h-[96px]")}
			/>
			{error && <ErrorLine id={errorId}>{error}</ErrorLine>}
		</div>
	);
}
