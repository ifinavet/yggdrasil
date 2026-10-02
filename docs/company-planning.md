# Company event planning

The company planning flow lives in Hugin and on the existing Bifrost event page.

## Approved flow

1. Five weeks before an event, notify the existing system and company/semester Slack channels that first contact is ready for internal review. Events without an order follow the same flow.
2. On the existing Bifrost event page, an organizer checks the company contact, package, prefilled answers, signature and exact invitation. Sending requires an explicit internal action.
3. Send a private Hugin form link to the company contact, with the main and co-organizers copied. Use the organizer's address only when the sender domain supports it; otherwise use the generic sender and organizer Reply-To.
4. Show the company logo and editable event details: title, teaser, description, language, package-limited capacity, start time, venue, food/drink, age restriction and stand preferences. Keep internal workflow details out of this form.
5. Require email confirmation of every submission using the listings confirmation pattern. Send verification only to the confirmed company contact.
6. Notify both Slack channels when a verified draft is ready. Internals edit, preview, approve and publish from banners/modals on the existing event page. Preserve published content until approval and reuse event update side effects.
7. Keep delivery failures and unresolved follow-up visible in Bifrost and Slack. Support correction, safe retry and documented manual follow-up.

## Implementation

- Shared form contract and email confirmation helpers.
- Event-driven preparation, explicit sending, delivery tracking and Slack integration.
- Company-facing form and verification in Hugin.
- Preparation, review, publication and recovery modals in Bifrost.
- Tests for authorization, verification, stale submissions, approval, delivery recovery and existing workflow regressions; type checks and UI verification.

The draft PR tracks verification and deployment status. Screenshots in `company-planning/` use fictional local test data.

## Runtime and operations

- `events/planning/lifecycle.discover` catches up eligible events every five minutes. It creates preparation records and Slack notices; it never sends an invitation automatically.
- The existing event channel mapping and durable Slack queues are reused. Delivery and publication failures retain actionable state on the event page. Unresolved planning follow-up keeps the event channel open.
- Email uses the existing tracked Resend component and signed `/resend-webhook` callback. Delivery recovery checks the provider queue when callbacks are delayed or missing. No additional webhook endpoint is needed.
- Set `PLANNING_VERIFIED_SENDER_DOMAIN=ifinavet.no` only when that domain is verified for sending in the configured Resend account. Matching organizer addresses then become the From address. Otherwise invitations use `Navet <info@ifinavet.no>` with the main organizer as Reply-To. All organizers receive invitation CC; confirmation emails never include CC.
- Private links keep their token in the URL fragment. The server stores token hashes for lookup. Delivery records retain the outgoing URL for reliable sending, and expose it in the internal API only in protected local development. Company pages disable analytics/error capture and indexing.
- Correcting the recipient or package, reopening, or finishing manually invalidates previous form links. Explicit retry is limited to failed invitations whose event and envelope still match; successful sends are not retried.
- Local development records email delivery without contacting Resend and exposes local preview links in the delivery modal. Test all external integrations against a configured test environment before production rollout.

Company form question order follows the original first-contact email, including its assisting text. A requested arrangement type is stored with the answers for internal review; it does not change the agreed package or its capacity limit.
