# Admissions security review

Reviewed the admissions PR diff and current preview/E2E changes on 2026-10-04, plus the existing IAM authorization paths. Applied the repository security-review skill and reported only verified, exploitable issues.

## Findings

No high-confidence vulnerabilities identified in the current preview implementation.

The admission forms and board are local previews. Hugin submission only updates component state (`setSent(true)`); the Bifrost board stores candidates, decisions, approval, send, and delete state in React. There are no admissions Convex tables, queries, or mutations to exploit. A client-controlled `?preview=open` cannot bypass the Hugin production gate because `Page` checks `isLocalDevelopment` before reading search parameters. That flag requires both `NODE_ENV === "development"` and `NEXT_PUBLIC_LOCAL_DEV === "true"` ([local.ts](../../packages/auth/local.ts), [Hugin admissions page](../../apps/hugin/src/app/admissions/page.tsx)). Bifrost also returns `notFound()` outside local development and the route remains under the admin-only layout ([Bifrost admissions page](<../../apps/bifrost/src/app/(admin-pages)/admissions/page.tsx>), [admin layout](<../../apps/bifrost/src/app/(admin-pages)/layout.tsx>)).

## Production blockers, not verified exploits

The requested production workflows are not implemented, so there are no admissions mutations on which to verify board create, decide, send, or delete authorization, or applicant self-only submission. Do not treat the hidden navigation item or local preview gate as a substitute for backend authorization when those APIs are added. Enforce board roles in each server mutation and derive an applicant's identity from the authenticated server context; validate ownership and the active application window there.

Existing public IAM mutations in [mutations.ts](../../packages/backend/convex/iam/mutations.ts) call `requireRole(ctx, adminRoles)` server-side. The onboarding path also calls `requireRightToManageRole` for an existing user, requiring a super-admin to manage a user with an admin-or-higher role. Internal actions are registered as `internalAction`, not client-callable. This evidence applies to existing IAM functions only and does not establish authorization for future admissions triggers.

## Authorization evidence

- Added [admissionsAuthorization.test.ts](../../packages/backend/convex/iam/admissionsAuthorization.test.ts): anonymous, student-profile, and internal-role callers cannot invoke `startOnboarding`; none creates an account. An admin caller succeeds.
- Existing `onboarding.test.ts` rejects internal callers and verifies only a super-admin can onboard an existing admin. `linking.test.ts` rejects internal callers for adding a UiO address and searching users. `offboarding.test.ts` restricts the IAM overview to admins. `reconcile.test.ts` rejects an internal caller for `checkNow`.
- On 2026-10-04, `pnpm exec vitest run convex/iam --coverage.enabled=false` from `packages/backend` passed: 11 test files, 106 tests. These are backend Convex tests, not browser E2E. Google and Slack HTTP are faked or mocked, and email delivery is spied or uses the test Resend component; no real provider calls were made.

No credentials or secrets were included in test artifacts or screenshots; admission E2E fixtures use synthetic data.
