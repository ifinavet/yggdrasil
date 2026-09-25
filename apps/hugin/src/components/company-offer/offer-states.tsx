import { NOTE_TONES, Note } from "@workspace/ui/components/note";
import { cn } from "@workspace/ui/lib/utils";
import { CalendarClock, Check, CircleAlert, Mail, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { quietLinkButtonClass } from "@/components/form-buttons";
import { COMPANY_OFFER_COPY } from "@/lib/company-offer-copy";
import { dayInSentence, offerSemesterName, osloDayAndTime } from "@/lib/company-offer-format";
import type { KnownOffer } from "./company-offer";
import { ContactLink, OFFER_TITLE_CLASS, OfferDayCard, OfferFacts } from "./offer-parts";

const COPY = COMPANY_OFFER_COPY.states;

type Tone = "ok" | "info" | "bad";

function StateHeading({
	tone,
	icon,
	title,
	children,
}: Readonly<{ tone: Tone; icon: ReactNode; title: string; children: ReactNode }>) {
	return (
		<>
			<div
				className={cn(
					"mt-[26px] grid size-[52px] place-items-center rounded-[14px] [&_svg]:size-[26px]",
					NOTE_TONES[tone],
					"border-0",
				)}
				aria-hidden
			>
				{icon}
			</div>
			<h1 className={cn(OFFER_TITLE_CLASS, "mt-[22px]")}>{title}</h1>
			<p className="m-0 mt-2.5 text-[14.5px] leading-normal">{children}</p>
		</>
	);
}

/** What goes before the label at `index`: nothing, a comma, or «eller» before the last one. */
function separatorBefore(index: number, count: number): string {
	if (index === 0) return "";
	return index === count - 1 ? COPY.or : ", ";
}

/** Bold labels joined as «a», «a eller b» or «a, b eller c». */
function orList(labels: string[]): ReactNode {
	return labels.map((label, index) => (
		<span key={label}>
			{separatorBefore(index, labels.length)}
			<b>{label}</b>
		</span>
	));
}

export function UnknownOffer() {
	return (
		<>
			<StateHeading tone="bad" icon={<CircleAlert />} title={COPY.unknownTitle}>
				{COPY.unknownBody}
			</StateHeading>
			<Note tone="bad" className="mt-[18px]">
				{COPY.unknownNote} <ContactLink />.
			</Note>
		</>
	);
}

export function AcceptedOffer({ offer }: Readonly<{ offer: KnownOffer }>) {
	return (
		<>
			<StateHeading tone="ok" icon={<Check strokeWidth={2.4} />} title={COPY.acceptedTitle}>
				{COPY.acceptedBody}
			</StateHeading>
			<OfferDayCard
				tone="accepted"
				date={offer.date}
				note={
					offer.respondedAt ? COPY.acceptedAt(osloDayAndTime(offer.respondedAt)) : COPY.accepted
				}
			/>
			<OfferFacts offer={offer} />
			<p className="m-0 mt-4 text-[13.5px] text-muted-foreground">{COPY.acceptedNext}</p>
		</>
	);
}

export function NewDateRequested({
	offer,
	onDecline,
}: Readonly<{ offer: KnownOffer; onDecline: () => void }>) {
	const requested = offer.requestedDates ?? [];

	return (
		<>
			<StateHeading tone="info" icon={<CalendarClock />} title={COPY.newDateTitle}>
				{requested.length > 0 && (
					<>
						{COPY.newDateAskedFor} {orList(requested.map(dayInSentence))}.{" "}
					</>
				)}
				{COPY.newDateBody}
			</StateHeading>
			<OfferDayCard tone="replaced" date={offer.date} note={COPY.newDateCard} />
			<div className="mt-4 flex">
				<button type="button" onClick={onDecline} className={quietLinkButtonClass}>
					{COPY.newDateDecline}
				</button>
			</div>
		</>
	);
}

export function SupersededOffer() {
	return (
		<>
			<StateHeading tone="info" icon={<Mail />} title={COPY.supersededTitle}>
				{COPY.supersededBody}
			</StateHeading>
			<Note className="mt-[18px]">
				{COPY.supersededNote} <ContactLink />
				{COPY.supersededNoteEnd}
			</Note>
		</>
	);
}

export function DeclinedOffer({ offer }: Readonly<{ offer: KnownOffer }>) {
	return (
		<>
			<StateHeading tone="info" icon={<Undo2 />} title={COPY.declinedTitle}>
				{COPY.declinedBody(offerSemesterName(offer.date, { inSentence: true }))}
			</StateHeading>
			<Note className="mt-[18px]">
				{COPY.declinedNote} <ContactLink />.
			</Note>
		</>
	);
}

export function InactiveOffer({ offer }: Readonly<{ offer: KnownOffer }>) {
	return (
		<>
			<StateHeading tone="bad" icon={<CircleAlert />} title={COPY.inactiveTitle}>
				{COPY.inactiveBody(offer.companyName, offerSemesterName(offer.date, { inSentence: true }))}
			</StateHeading>
			<Note tone="bad" className="mt-[18px]">
				{COPY.inactiveNote} <ContactLink />.
			</Note>
		</>
	);
}
