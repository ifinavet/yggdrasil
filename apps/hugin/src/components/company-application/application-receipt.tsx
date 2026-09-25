"use client";

import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { ESCAPE_LABELS, EVENT_TYPE_LABELS, VENUE_LABELS } from "@workspace/shared/semester/labels";
import { Button } from "@workspace/ui/components/button";
import { Check, FileQuestion } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { linkClass } from "@/components/form-controls";
import { FormStatePanel } from "@/components/form-state-panel";
import {
	billingLines,
	compactDateList,
	dayAndMonth,
	formatOrgNumber,
	studentRange,
} from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { loadReceipt, type StoredReceipt } from "@/lib/company-application-storage";

const ROWS = COPY.receipt.rows;

/**
 * /bestill-bedpres/kvittering: what the company sent, read from this tab's session storage. No
 * copy is emailed, so this page is the company's only record of the application.
 */
export function ApplicationReceipt() {
	// undefined while reading storage, which only exists in the browser.
	const [receipt, setReceipt] = useState<StoredReceipt | null | undefined>(undefined);

	useEffect(() => {
		setReceipt(loadReceipt());
	}, []);

	if (receipt === undefined) return null;

	if (receipt === null) {
		return (
			<FormStatePanel
				icon={<FileQuestion className="size-6" />}
				title={COPY.receipt.missingTitle}
				body={COPY.receipt.missingBody}
				action={
					<Button asChild className="h-[52px] w-full rounded-[13px] font-semibold text-[15.5px]">
						<Link href="/bestill-bedpres">{COPY.receipt.back}</Link>
					</Button>
				}
			/>
		);
	}

	const { company } = receipt;

	return (
		<div className="pt-1.5">
			<div className="mt-1 grid size-[46px] place-items-center rounded-xl bg-primary-light text-primary">
				<Check aria-hidden className="size-6" strokeWidth={2.4} />
			</div>
			<h1 className="m-0 mt-4 font-bold text-[21px] text-primary leading-[1.22] tracking-[-0.015em] dark:text-primary-foreground">
				{COPY.receipt.title}
			</h1>
			<p className="m-0 mt-2 text-[14.5px] leading-normal">
				{receipt.late
					? COPY.receipt.lateBody
					: COPY.receipt.body(dayAndMonth(receipt.applicationDeadline))}
			</p>
			<p className="m-0 mt-2 text-[13.5px] text-muted-foreground">{COPY.receipt.keep}</p>

			<section
				aria-labelledby="receipt-summary"
				className="mt-[18px] rounded-[14px] border border-border bg-card px-4 py-3.5"
			>
				<h2
					id="receipt-summary"
					className="m-0 mb-2.5 font-semibold text-[13px] text-muted-foreground"
				>
					{COPY.receipt.summary}
				</h2>
				<dl className="m-0 grid grid-cols-[92px_1fr] gap-y-[9px] text-[13.5px] tabular-nums leading-[1.4]">
					<Row label={ROWS.company}>
						{company.name}
						<br />
						<span className="text-muted-foreground">{formatOrgNumber(company.orgNumber)}</span>
					</Row>
					<Row label={ROWS.type}>{EVENT_TYPE_LABELS[receipt.eventType]}</Row>
					<Row label={ROWS.students}>{studentRange(receipt.minStudents, receipt.maxStudents)}</Row>
					<Row label={ROWS.dates}>{compactDateList(receipt.availableDates)}</Row>
					<Row label={ROWS.venue}>{VENUE_LABELS[receipt.venue]}</Row>
					<Row label={ROWS.escape}>{ESCAPE_LABELS[receipt.wantsToUseEscape]}</Row>
					<Row label={ROWS.invoice}>
						{billingLines(receipt.billing).map((line) => (
							<span key={line} className="block whitespace-pre-line break-words">
								{line}
							</span>
						))}
					</Row>
				</dl>
			</section>

			<p className="m-0 mt-[18px] text-center text-[13.5px] text-muted-foreground">
				{COPY.receipt.wrong}{" "}
				<a href={`mailto:${COMPANY_CONTACT_EMAIL}`} className={linkClass}>
					{COMPANY_CONTACT_EMAIL}
				</a>
			</p>
		</div>
	);
}

function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="m-0 min-w-0 break-words">{children}</dd>
		</>
	);
}
