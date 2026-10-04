# Admissions E2E coverage

## Student

`student.spec.ts` exercises the Hugin local preview at `?preview=open` and `?preview=closed`: profile editing and confirmation, required and minimum-length question validation, required work group validation, availability selection in both weeks and persistence while switching weeks, independent submit gates for profile, availability, and consent, the local confirmation, and the closed-period message. Reloading clears the in-memory answers and profile edit.

These tests cover only client-side preview behavior. Profile edits and submission remain in memory; no backend persistence or email delivery occurs. The integration gaps are the Midgard banner and authentication, persisted profile changes and real application submission, interview invitations/reminders/cancellation, and decision emails.

## Board

`board.spec.ts` exercises the Bifrost local admissions preview at `localhost:3021/admissions`: interview duration, buffer, break and lunch settings, room and interviewer selection, the test calendar source dialog, schedule rebuild and simulated approval, unmatched candidate review and a simulated additional-time request, individual and bulk room assignment, candidate search and program filtering, notes and accepted/rejected decisions, selection round advance and restore, simulated decision sending, and simulated delete/reset. Set `ADMISSIONS_SCREENSHOTS=1` to save review screenshots under `docs/admissions/screenshots/board/`.

These tests cover local client state only. Calendar data is synthetic, approval does not create invitations, requests and email are simulated, and delete affects preview test data. They do not verify Google Calendar access, persistent admissions data, production scheduling, room booking, candidate communication, or external account effects.

## Verification

On 2026-10-04, `pnpm test:e2e:admissions` passed all 9 Chromium tests (3 student and 6 board). This is browser coverage of the local UI preview, not the unimplemented production integrations.
