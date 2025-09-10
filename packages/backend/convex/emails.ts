"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
import AvailableSeatEmail from "@workspace/emails/available-seat-email";
import FreeForAllEmail from "@workspace/emails/free-for-all-email";
import LockedOutEmail from "@workspace/emails/locked-out-email";
import PointsEmail from "@workspace/emails/point-email";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendGottenPointsEmail = internalAction({
	args: {
		participantEmail: v.string(),
		severity: v.number(),
		reason: v.string(),
	},
	handler: async (ctx, { participantEmail, severity, reason }) => {
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

export const sendTooManyPointsEmail = internalAction({
	args: {
		participantEmail: v.string(),
	},
	handler: async (ctx, { participantEmail }) => {
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

export const sendAvailableSeatEmail = internalAction({
	args: {
		participantEmail: v.string(),
		eventId: v.id("events"),
		eventTitle: v.string(),
		registrationId: v.id("registrations"),
	},
	handler: async (ctx, { participantEmail, eventId, eventTitle, registrationId }) => {
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

export const sendFreeForAll = internalAction({
	args: {
		participantEmail: v.string(),
		eventId: v.id("events"),
		eventTitle: v.string(),
		availableSeats: v.number(),
	},
	handler: async (ctx, { participantEmail, eventId, eventTitle, availableSeats }) => {
		const url = `https://ifinavet.no/events/${eventId}`;

		const html = await pretty(await render(FreeForAllEmail({
			event: eventTitle,
			url,
			availableSeats
		})));

		await resend.sendEmail(ctx, {
			from: "Navet <info@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
			to: participantEmail,
			subject: `Det er ${availableSeats} ledige plasser, første mann til mølla!`,
			html,
		});
	},
});
