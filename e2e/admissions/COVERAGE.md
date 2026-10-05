# Admissions E2E coverage

The admissions E2E suite now contains separate preview checks and real Convex-backed journeys. Real-flow tests use local sign-in and reset synthetic seed data in the isolated local backend; they do not contact live calendar, Slack, IAM, or email providers.

## Applicant

`student.spec.ts` covers the Hugin `?preview=open` and `?preview=closed` examples. These remain in-memory previews.

`student-production.spec.ts` covers the Midgard application banner, existing profile confirmation and edit, answers, work group, multi-day availability, consent, persistent submission and reopen/edit, updated Midgard profile, assigned interview and cancellation, explicit no-suitable-times submission, pending offer acceptance and decline, expired offer response, cancellation state after reload, closed-period state, and missing-profile recovery. The tests also check that the offer is not exposed before sending and that applicant pages do not show board notes. The real flow screenshots use the `live-` prefix under `test-results/admissions/screenshots/student/`.

## Board

`board.spec.ts` covers the local Bifrost preview and simulated client state only.

The production browser suites cover persistent room updates and notes, declined-offer replacement, schedule generation and publication, period creation and calendar selection, selection rounds and explicit decision sending, manual interview actions/cancellation, interviewer-team editing and published-slot protection, and close confirmation. Local email HTML can be captured for invitations, offers, rejections, and cancellation notices when the corresponding flow queues the message. The screenshots are saved under `test-results/admissions/screenshots/board/` and `test-results/admissions/screenshots/student/` with `live-` names.

## Backend and limits

Convex tests cover applicant/admin authorization, window/revision rules, sent-versus-unsent decisions, acceptance/decline onboarding behavior, sanitized identity-conflict errors, cancellation and 48-hour refill eligibility, schedule constraints, close ordering, purge, and recovery. Relevant tests live in `packages/backend/convex/admissions/` and `packages/backend/convex/users/students/`.

Local email screenshots show rendered HTML from the local delivery capture, not an email delivered by Resend. The suite does not verify live Google Calendar, Slack, IAM, or Resend credentials, account effects, or provider callbacks. Reminder retry tests capture both reminder emails and verify that retrying failed jobs does not duplicate delivery. Live reminder timing and welcome email screenshots are not covered yet. See the [integration coverage matrix](../../docs/admissions/integration-coverage.md) for remaining controlled pre-production checks.

Enable `ADMISSIONS_SCREENSHOTS=1` to refresh local screenshots. Never use real applicant data, tokens, or credentials in screenshots or test artifacts.
