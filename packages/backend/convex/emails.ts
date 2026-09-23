"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
import ApplicationReceiptEmail from "@workspace/emails/application-receipt-email";
import AvailableSeatEmail from "@workspace/emails/available-seat-email";
import CompanyOfferConfirmedEmail from "@workspace/emails/company-offer-confirmed-email";
import CompanyOfferEmail from "@workspace/emails/company-offer-email";
import { COMPANY_CONTACT_EMAIL } from "@workspace/emails/constants";
import FreeForAllEmail from "@workspace/emails/free-for-all-email";
import LockedOutEmail from "@workspace/emails/locked-out-email";
import OfferResponseNoticeEmail from "@workspace/emails/offer-response-notice-email";
import PointsEmail from "@workspace/emails/point-email";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { type ActionCtx, internalAction } from "./_generated/server";
import { isLocalDevelopment } from "./auth/local";

/**
 * Configures the Resend client used by backend email actions.
 */
export const resend: Resend = new Resend(components.resend, {
	testMode: false,
});

/**
 * Sends the email informing a participant that they received points.
 *
 * @param {string} participantEmail - The recipient email address.
 * @param {number} severity - The number of points assigned.
 * @param {string} reason - The reason for the points.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendGottenPointsEmail = internalAction({
	args: {
		participantEmail: v.string(),
		severity: v.number(),
		reason: v.string(),
	},
	handler: async (ctx, { participantEmail, severity, reason }) => {
		if (isLocalDevelopment()) return;

		const html = await pretty(
			await render(
				PointsEmail({
					severity,
					reason,
				}),
			),
		);

		await resend.sendEmail(ctx, {
			from: "Navet <prikker@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
			to: participantEmail,
			subject: "Du har fått prikk(er).",
			html,
		});
	},
});

/**
 * Sends the email informing a participant that they have exceeded the points threshold.
 *
 * @param {string} participantEmail - The recipient email address.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendTooManyPointsEmail = internalAction({
	args: {
		participantEmail: v.string(),
	},
	handler: async (ctx, { participantEmail }) => {
		if (isLocalDevelopment()) return;

		const html = await pretty(await render(LockedOutEmail()));

		await resend.sendEmail(ctx, {
			from: "Navet <prikker@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
			to: participantEmail,
			subject: "Du har fått for mange prikker.",
			html,
		});
	},
});

/**
 * Sends the email offering a waitlisted participant an available seat.
 *
 * @param {string} participantEmail - The recipient email address.
 * @param {Id<"events">} eventId - The id of the event.
 * @param {string} eventTitle - The event title.
 * @param {Id<"registrations">} registrationId - The registration id used in the acceptance URL.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendAvailableSeatEmail = internalAction({
	args: {
		participantEmail: v.string(),
		eventId: v.id("events"),
		eventTitle: v.string(),
		registrationId: v.id("registrations"),
	},
	handler: async (ctx, { participantEmail, eventId, eventTitle, registrationId }) => {
		if (isLocalDevelopment()) return;

		const url = `https://ifinavet.no/events/${eventId}/registration/${registrationId}`;

		const html = await pretty(
			await render(
				AvailableSeatEmail({
					event: eventTitle,
					url,
				}),
			),
		);

		await resend.sendEmail(ctx, {
			from: "Navet <info@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
			to: participantEmail,
			subject: `Godta plass på ${eventTitle}`,
			html,
		});
	},
});

/**
 * Sends the free-for-all email for released event seats.
 *
 * @param {string} participantEmail - The recipient email address.
 * @param {Id<"events">} eventId - The id of the event.
 * @param {string} eventTitle - The event title.
 * @param {number} availableSeats - The number of available seats.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendFreeForAll = internalAction({
	args: {
		participantEmail: v.string(),
		eventId: v.id("events"),
		eventTitle: v.string(),
		availableSeats: v.number(),
	},
	handler: async (ctx, { participantEmail, eventId, eventTitle, availableSeats }) => {
		if (isLocalDevelopment()) return;

		const url = `https://ifinavet.no/events/${eventId}`;

		const html = await pretty(
			await render(
				FreeForAllEmail({
					event: eventTitle,
					url,
					availableSeats,
				}),
			),
		);

		await resend.sendEmail(ctx, {
			from: "Navet <info@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
			to: participantEmail,
			subject: `Det er ${availableSeats} ledige plasser, første mann til mølla!`,
			html,
		});
	},
});

const summaryRowsValidator = v.array(v.object({ label: v.string(), value: v.string() }));

/**
 * Sends the receipt for a company application to the contact person and whoever filled it in.
 *
 * @param {string[]} to - The recipient email addresses.
 * @param {string} companyName - The company name from Enhetsregisteret.
 * @param {string} semesterLabel - The semester, e.g. «våren 2027».
 * @param {{ label: string, value: string }[]} rows - The answers, as shown on the receipt page.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendApplicationReceiptEmail = internalAction({
	args: {
		to: v.array(v.string()),
		companyName: v.string(),
		semesterLabel: v.string(),
		rows: summaryRowsValidator,
	},
	handler: async (ctx, { to, companyName, semesterLabel, rows }) => {
		if (isLocalDevelopment()) return;

		await sendCompanyEmail(
			ctx,
			to,
			`Søknad om bedriftsarrangement ${semesterLabel} er mottatt`,
			ApplicationReceiptEmail({ companyName, semesterLabel, rows }),
		);
	},
});

/**
 * Sends an offer to a company's contact person, with the personal link to answer it.
 *
 * @param {string} to - The contact person's email address.
 * @param {string} url - The offer link. It contains the plaintext token, which is stored nowhere else.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendOfferEmail = internalAction({
	args: {
		to: v.string(),
		contactName: v.string(),
		companyName: v.string(),
		dateLabel: v.string(),
		eventTypeLabel: v.string(),
		maxStudents: v.number(),
		url: v.string(),
		respondByLabel: v.optional(v.string()),
	},
	handler: async (ctx, { to, ...offer }) => {
		if (isLocalDevelopment()) return;

		await sendCompanyEmail(
			ctx,
			to,
			`Tilbud om bedriftsarrangement ${offer.dateLabel}`,
			CompanyOfferEmail(offer),
		);
	},
});

/**
 * Confirms to a company that it has accepted its date.
 *
 * @param {string[]} to - The contact person, and whoever filled in the application.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendOfferConfirmedEmail = internalAction({
	args: { to: v.array(v.string()), companyName: v.string(), dateLabel: v.string() },
	handler: async (ctx, { to, companyName, dateLabel }) => {
		if (isLocalDevelopment()) return;

		await sendCompanyEmail(
			ctx,
			to,
			`Bekreftet: bedriftsarrangement ${dateLabel}`,
			CompanyOfferConfirmedEmail({ companyName, dateLabel }),
		);
	},
});

/**
 * Tells the bedriftskontakt that a company accepted an offer or asked for another date.
 *
 * @param {string} to - Navet's company contact address, COMPANY_CONTACT_EMAIL.
 *
 * @returns {Promise<void>} - Resolves when the email has been sent.
 */
export const sendOfferResponseNoticeEmail = internalAction({
	args: {
		to: v.string(),
		companyName: v.string(),
		answer: v.union(v.literal("accepted"), v.literal("new_date_requested")),
		rows: summaryRowsValidator,
	},
	handler: async (ctx, { to, companyName, answer, rows }) => {
		if (isLocalDevelopment()) return;

		const subject =
			answer === "accepted"
				? `${companyName} har godtatt tilbudet`
				: `${companyName} ber om en annen dato`;
		await sendCompanyEmail(
			ctx,
			to,
			subject,
			OfferResponseNoticeEmail({ companyName, answer, rows }),
		);
	},
});

/**
 * Sends a semester planning email from COMPANY_CONTACT_EMAIL, where companies reply.
 *
 * @param {ActionCtx} ctx - The Convex action context.
 * @param {string | string[]} to - The recipient or recipients.
 * @param {string} subject - The subject line.
 * @param {React.ReactElement} email - The email template to render.
 *
 * @returns {Promise<void>} - Resolves when the email has been handed to Resend.
 */
async function sendCompanyEmail(
	ctx: ActionCtx,
	to: string | string[],
	subject: string,
	email: Parameters<typeof render>[0],
): Promise<void> {
	await resend.sendEmail(ctx, {
		from: `Navet <${COMPANY_CONTACT_EMAIL}>`,
		replyTo: [COMPANY_CONTACT_EMAIL],
		to,
		subject,
		html: await pretty(await render(email)),
	});
}
