"use client";

import type { ReactNode } from "react";
import type { Application } from "./model";
import { CardSection, DetailList } from "./section";

/** «Kontakt»: the contact person, who gets the offer. */
export function ContactCard({ application }: Readonly<{ application: Application }>) {
	const { contact } = application;
	const items: [string, ReactNode][] = [
		["Navn", contact.name],
		[
			"E-post",
			<a key="email" href={`mailto:${contact.email}`} className="hover:underline">
				{contact.email}
			</a>,
		],
		[
			"Telefon",
			<a key="phone" href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:underline">
				{contact.phone}
			</a>,
		],
	];
	return (
		<CardSection title="Kontaktperson">
			<DetailList items={items} />
		</CardSection>
	);
}

/** «Faktura»: how the company wants the invoice, as it wrote it in the application. */
export function BillingCard({ application }: Readonly<{ application: Application }>) {
	const { billing } = application;
	const items: [string, ReactNode][] = [];
	if (billing.email) {
		items.push([
			"E-post",
			<a key="email" href={`mailto:${billing.email}`} className="hover:underline">
				{billing.email}
			</a>,
		]);
	}
	if (billing.details) {
		items.push([
			"Info",
			<span key="details" className="whitespace-pre-line">
				{billing.details}
			</span>,
		]);
	}
	if (billing.ehfInvoice) items.push(["EHF-faktura", "Ja"]);

	return (
		<CardSection title="Faktura">
			{items.length > 0 ? (
				<DetailList items={items} />
			) : (
				<p className="text-muted-foreground">Bedriften oppga ingen fakturadetaljer.</p>
			)}
		</CardSection>
	);
}
