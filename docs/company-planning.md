# Company event planning

Implementation in progress on `feat/company-planning-flow`, based on `origin/main`.

## Approved flow

1. Five weeks before an event, notify the existing system and company/semester Slack channels that first contact is ready for internal review. Events without an order follow the same flow.
2. On the existing Bifrost event page, an organizer checks the company contact, package, prefilled answers, signature and exact invitation. Sending requires an explicit internal action.
3. Send a private Hugin form link to the company contact, with the main and co-organizers copied. Use the organizer's address only when the sender domain supports it; otherwise use the generic sender and organizer Reply-To.
4. Show the company logo and editable event details: title, teaser, description, language, package-limited capacity, start time, venue, food/drink, age restriction and stand preferences. Keep internal workflow details out of this form.
5. Require email confirmation of every submission using the listings confirmation pattern. Send verification only to the confirmed company contact.
6. Notify both Slack channels when a verified draft is ready. Internals edit, preview, approve and publish from banners/modals on the existing event page. Preserve published content until approval and reuse event update side effects.
7. Keep delivery failures and unresolved follow-up visible in Bifrost and Slack. Support correction, safe retry and documented manual follow-up.

## Implementation checkpoints

- Shared form contract and email confirmation helpers.
- Event-driven preparation, explicit sending, delivery tracking and Slack integration.
- Company-facing form and verification in Hugin.
- Preparation, review, publication and recovery modals in Bifrost.
- Tests for authorization, verification, stale submissions, approval, delivery recovery and existing workflow regressions; type checks and UI verification.

This document describes the intended flow, not a deployment or verification claim. The draft PR tracks implementation and validation status.
