# Admissions security review

Reviewed the real applicant and board flows on 2026-10-05, including backend authorization, offer handling, profile recovery, close/retention behavior, and the local Playwright journeys. The review found and fixed an applicant-facing identity leak on offer acceptance; no known high-confidence issue remains in the reviewed paths.

## Verified controls

- Applicant identity is derived from the authenticated Convex caller. `myApplication`, `currentApplication`, profile updates, submission, cancellation, and offer response are scoped to that caller. Tests reject anonymous or other-student access and reject duplicate/stale submissions.
- Board queries and mutations require admin authorization on the server. Calendar discovery and scheduling actions are also admin-only; hiding a UI control is not the access boundary.
- Applicant views expose only their own application, published interview information, and sent decision/offer state. Board notes and unsent decisions are not returned to applicants.
- Application writes and submit/reopen actions validate the period, revision, and applicant on the server. Submission requires consent; the accepted consent version and timestamp are retained with the application.
- A sent offer does not create membership. Only the applicant's authenticated acceptance starts the existing onboarding path; decline does not provision IAM access. Duplicate and stale replies are rejected.
- The onboarding acceptance boundary converts expected IAM identity conflicts to a generic applicant error. The transaction rolls back, leaving the offer pending, and the regression test verifies that private email addresses and names do not appear in the error.
- Missing student profiles now use an authenticated nullable query, allowing Hugin to show a recovery link to the existing Midgard profile route instead of failing before the recovery UI can render.
- Closing blocks admissions reads and writes, waits for interview calendar cleanup and Slack archive work, and purges admissions data in bounded batches. The student's ordinary profile and independent member account are outside the admissions purge.
- The local admissions seed mutation is local-mode and admin gated. The Hugin `/admissions` route uses real Convex queries and mutations. Static demo routes and their client-only state have been removed.

Relevant implementation and regression coverage: [admissions queries](../../packages/backend/convex/admissions/queries.ts), [admissions mutations](../../packages/backend/convex/admissions/mutations.ts), [lifecycle cleanup](../../packages/backend/convex/admissions/lifecycle.ts), [student profile queries](../../packages/backend/convex/users/students/queries.ts), [admissions backend tests](../../packages/backend/convex/admissions/admissions.test.ts), [student profile tests](../../packages/backend/convex/users/students/students.test.ts), and [real applicant journeys](../../e2e/admissions/student-production.spec.ts).

## Verification limits

Browser and Convex tests use synthetic applicants, local authentication, and an isolated local deployment. They do not demonstrate the behavior of production Google Calendar, Slack, IAM, or Resend accounts. Email HTML captures are rendered from the local outbox; they confirm template output only, not delivery. Live provider authorization, callbacks, failure recovery, policy approval, and deployed sign-in configuration still need controlled pre-production verification.

The review did not validate every adversarial input or every deployment configuration. Continue enforcing authorization in every new server function, keep applicant errors generic, and avoid logging applicant answers, notes, identity records, or credentials.
