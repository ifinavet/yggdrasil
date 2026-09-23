"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
import ApplicationReceiptEmail from "@workspace/emails/application-receipt-email";
import AvailableSeatEmail from "@workspace/emails/available-seat-email";
import { COMPANY_CONTACT_EMAIL } from "@workspace/emails/constants";
import FreeForAllEmail from "@workspace/emails/free-for-all-email";
import LockedOutEmail from "@workspace/emails/locked-out-email";
import PointsEmail from "@workspace/emails/point-email";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
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
		rows: v.array(v.object({ label: v.string(), value: v.string() })),
	},
	handler: async (ctx, { to, companyName, semesterLabel, rows }) => {
		if (isLocalDevelopment()) return;

		const html = await pretty(
			await render(ApplicationReceiptEmail({ companyName, semesterLabel, rows })),
		);

		await resend.sendEmail(ctx, {
			from: `Navet <${COMPANY_CONTACT_EMAIL}>`,
			replyTo: [COMPANY_CONTACT_EMAIL],
			to,
			subject: `Søknad om bedriftsarrangement ${semesterLabel} er mottatt`,
			html,
		});
	},
});
