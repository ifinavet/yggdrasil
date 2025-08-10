"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
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
