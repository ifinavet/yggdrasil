# Plan: the product is the only definition of an event type

Status: plan for review, revision 2. No code in this pull request.

Revision 2 follows a review by GPT-6 Astra, run read-only against the code. Its findings were checked against the files it cited and all of them held. The section "What the review changed" lists them.

## The problem

Two things describe what a company has bought.

1. A hard-coded enum, `EVENT_TYPES` in `packages/shared/semester/labels.ts`, with four values: `standard_presentation`, `large_presentation`, `workshop`, `social`. Hard-coded tables hang off it: `EVENT_TYPE_LABELS`, `EVENT_TYPE_SHORT_LABELS`, `EVENT_TITLE_PREFIX` and `STUDENT_CAP`.
2. The `products` table, which an admin edits in Bifrost. A product has a name, a price, a VAT rate and a student cap.

They repeat each other. `EVENT_TYPE_LABELS.standard_presentation` is "Ordinær bedriftspresentasjon", and so is the seeded product name. `STUDENT_CAP.standard_presentation` is 40, and so is the seeded product's `maxStudents`. When an admin renames a product or changes its cap, the application form, the Bifrost tables and the emails keep showing the hard-coded value.

The two are joined at runtime by a guess: "the first active product whose `eventType` matches". That lookup is written out four times.

The bug that started this: the Slack alert for a new application always says `Type: Bedriftspresentasjon`, for ordinary, large and workshop alike, because the string is hard-coded in `semesterPlanning/applications/confirmation.ts:334`.

## The decision

A product reference is the only definition of what kind of event something is. Name, price, VAT and student cap are read from the product. The enum and its four tables are deleted.

Applications, offers and planning read the product live. If an admin renames a product, they all show the new name.

Events keep the copy of the product they were sold as (`event.product`: reference, name, price, VAT). This plan does not change that copy. See open decision 1.

## Decided

- A product has one name. The short labels "Ordinær", "Stor" and "Faglig" are deleted and no short name field is added. Dense tables show `product.name`, and the full name stays available to screen readers and on hover when a cell truncates.
- A rename shows everywhere at once for applications, offers and planning. They do not keep a copy of the name.
- Job listing orders keep their stored `productName`. It is a receipt of what was bought.

## What stores a type today

The `events` table has no type field. The type is stored in these places:

| Table or object | Field | Defined in |
|---|---|---|
| `pendingCompanyApplications.form` | `eventType`, required | `semesterPlanning/schema.ts:111` |
| `companyApplications` | `eventType`, required | `semesterPlanning/schema.ts:178` |
| offers | `eventType`, required | `semesterPlanning/schema.ts:219` |
| `eventPlanning` | `eventType`, optional | `events/planning/schema.ts:31` |
| `eventPlanning.answers` | `requestedEventType`, optional | `events/planning/schema.ts:9` |
| `eventPlanningSubmissions.answers` and `.draft` | `requestedEventType`, optional | `events/planning/schema.ts:61`, same validator |
| `products` | `eventType`, index `by_eventType_and_active` | `products/schema.ts:62` |
| Browser storage in Hugin | `eventType` in a saved, unsent application | `apps/hugin/src/lib/company-application-storage.ts:16` |

References outside tests: 173 lines in 37 files. In tests: 35 lines in 13 files. Counted with `git grep` for `eventType`, `EventType`, `EVENT_TYPE`, `STUDENT_CAP`, `EVENT_TITLE_PREFIX` and `planningCapacityLimit`.

## Target state

| Table or object | Before | After |
|---|---|---|
| `pendingCompanyApplications.form` | `eventType` | `productId` |
| `companyApplications` | `eventType` | `productId` |
| offers | `eventType` | `productId` |
| `eventPlanning` | `eventType` | `productId`, still optional |
| planning answers, in `eventPlanning` and `eventPlanningSubmissions` | `requestedEventType` | `requestedProductId` |
| `products` | `eventType` and its index | removed |
| `events.product` and `jobListings.product` | unchanged | unchanged |

Deleted from `packages/shared`: `EVENT_TYPES`, `EventType`, `APPLICATION_EVENT_TYPES`, `ApplicationEventType`, `EVENT_TYPE_LABELS`, `EVENT_TYPE_SHORT_LABELS`, `EVENT_TITLE_PREFIX`, `STUDENT_CAP`, `planningCapacityLimit`.

## What replaces each hard-coded table

| Hard-coded today | Used in | Replacement |
|---|---|---|
| `EVENT_TYPE_LABELS` | 12 files: Hugin form, receipt and offer page, Bifrost application card, edit form and planning panel, the shared planning form, the shared Zod schema, planning emails and notifications, Google Sheet row | `product.name` |
| `EVENT_TYPE_SHORT_LABELS` | 5 Bifrost files: applications tab, distribution matrix, assign cell, plan cards, plan table | `product.name` |
| `STUDENT_CAP` | Hugin form validation, shared Zod schema, planning capacity limit | `product.maxStudents`. No value means no product cap, and the existing limit of 1 to 1000 students still applies (`shared/semester/application.ts:25`). |
| `EVENT_TITLE_PREFIX` | one place, the Slack alert title | removed. The alert names the product and the company. |
| `APPLICATION_EVENT_TYPES` | which types a company can apply for | open decision 2 |
| "first active product with this type" lookup | `confirmation.ts:324`, `semesterPlanning/events.ts:138`, `invoicing/details.ts:56`, `products/queries.ts:24` | `ctx.db.get(row.productId)` |

Events are created with a placeholder title that a person fills in later, so nothing needs a "kind" field on the product. That is what allows the enum to go completely.

The list of products comes from the existing active-product query (`products/queries.ts:9`). No new query.

## Behaviour that must not change

- Agreed product and requested product stay separate. A company asking for another product in the planning form does not change what it has bought. Navet decides (`event-planning-panel.tsx:396`).
- `productGuessed` keeps its meaning. A guessed product on an event does not count as the agreed type (`events/planning/helpers.ts:144`).
- The agreed product on planning stays optional. "Bekreft avtalt arrangementstype" still shows when it is missing.
- Changing the agreed product still invalidates the sent invitation, as changing `eventType` does today (`events/planning/admin.ts:148`).
- Capacity is still enforced in planning, from the product's cap.
- Planning's event fingerprint includes `event.product` (`events/planning/helpers.ts:51`). Leaving the copy unchanged keeps existing fingerprints valid.
- Invoicing: an invoice's text and price are stored when it is marked sent (`invoicing/admin.ts:117`) and discarded when it is reopened (`invoicing/admin.ts:135`). Until then they are computed from `event.product`, and from the live product where the copy lacks a price or VAT (`invoicing/details.ts:60`). This plan does not change that. It only changes the fallback for an event with no copy at all, from the type lookup to the application's product.

## Backwards compatibility

The current semester has applications, offers, planning rows, submissions and events in production. None of them may break or change meaning.

### Data

1. New fields are optional when they are added.
2. A field is only removed from the schema after no row holds it. Convex rejects a deploy otherwise. The function that clears a field must therefore be deployed and run in an earlier pull request than the one that removes it from the schema.
3. Before writers stop setting a required legacy field, that field is made optional. Otherwise the first new row fails validation.
4. The backfill only adds. It never overwrites a `productId` that is set and never deletes a row.
5. The backfill prefers what was actually sold over what the type maps to today. For an application with an event whose product copy is not guessed, it takes `event.product.productId`. Otherwise it maps the type to the active product with that type. Where the two disagree, it reports the row and sets nothing. An admin can retag an event independently of its application (`products/tagging.ts:49`), so today's active product is not proof of the purchase.
6. Every row must be resolved before the old field is cleared. "Reported and left alone" is a state during the work, never the end state, because the last pull request deletes the only other record of the type. Rows the backfill cannot map are resolved by hand, one by one, with Victor.

### Clients

The backend deploys before the frontends (`deploy-production.yml:83`), and people keep tabs open. Old browser code calls the new backend for a while after every deploy.

7. Public functions keep accepting the old arguments and returning the old fields until the pull request after the one that switches the frontends. `eventTypePrices` and the `eventType` argument to submit stay through pull request B and go in C.
8. A saved, unsent application in the browser holds `eventType`. The form converts it to the matching product when it loads, or clears that one answer and asks again if no product matches. It never discards the rest of the draft.
9. A pending application that a company confirms from an old email holds only `form.eventType`. The confirm step resolves the product the same way the backfill does.

## Pull requests

Three. Each one deploys on its own, and production never holds a row the deployed code cannot read.

### A. Add the product reference

Additive only.

- Schema: optional `productId` on the pending application form, applications, offers and `eventPlanning`. Optional `requestedProductId` in planning answers, which covers `eventPlanning` and `eventPlanningSubmissions`.
- Writers set both the old type and the new reference.
- One helper, `productOf(ctx, row)`, returns the product from `productId` and otherwise falls back to the old type lookup. The four lookups move to it.
- Backfill migrations with `@convex-dev/migrations`, the library `products/migrations.ts` already uses, one per table.
- An internal query that reports, per table: rows with `productId`, rows without, rows the backfill refused and why.
- The Slack alert reads the product name. This fixes the original bug.

Gate before B: the report from production shows no unresolved row.

### B. Switch readers and writers

- Schema: the legacy `eventType` fields on pending applications, applications and offers become optional.
- Hugin application form: the choices are products. It submits `productId`. The browser and the shared Zod schema validate the student count against the chosen product's cap, and the server validates again against the product it loads.
- The form gets a loading state and an empty state. Today it shows hard-coded choices at once and fills in prices when they arrive (`event-questions.tsx:36`). With choices from the database, there is nothing to show until they load. This is a visible change and gets a design mock for approval before it is built.
- Bifrost: application card, edit form, applications tab, distribution matrix, assign cell, plan cards and plan table show the product name.
- Planning: the admin panel and the company form pick a product. The cap comes from the product.
- Emails, the Google Sheet row and planning notifications use the product name.
- Old endpoints and arguments stay, per rule 7.
- Writers stop setting the legacy fields.
- The functions that clear the legacy fields are deployed, including for nested planning answers in submissions. They are run after B is live and the frontends have deployed.

Gate before C: the report shows no row holding `eventType` or `requestedEventType` in any table, and no row without a product reference where one is required.

### C. Remove the old fields

- Schema: remove `eventType` from pending applications, applications, offers and `eventPlanning`, `requestedEventType` from planning answers, and `products.eventType` with its index. Make `productId` required on applications and offers.
- Delete the enum, the four tables, `planningCapacityLimit`, the `productOf` fallback, `eventTypePrices`, the old submit argument and the `eventType` argument to the seed helper.
- `products/migrations.ts` guesses a product for old events from `STUDENT_CAP.standard_presentation`. That backfill has run. Decide when writing C whether to retire the file or keep it with the number as a local constant.

## Tests

Migration and compatibility tests come first. They cover the cases where data can be lost or mislabelled.

- Backfill: maps the three applied types. Leaves a row with `productId` untouched. Takes the event's product when the event has a real copy. Reports a conflict between the event's product and the type. Reports an archived product, a type with two active products, and a type with none. Covers nested answers in planning submissions.
- `productOf`: returns the referenced product, falls back for a row without `productId`, returns nothing when neither exists.
- Old client: submit with only `eventType` still works after B, and `eventTypePrices` still answers.
- Pending application confirmed after B with only `form.eventType`: is received and gets a `productId`.
- Saved browser draft with `eventType`: converts, or clears that one answer.
- Invoicing: an event with a product copy invoices at the copied price after the product's price is edited. A reopened invoice is recomputed the same way as today.
- Planning: changing the agreed product invalidates the invitation. A requested product does not change the agreed one. A guessed product is not treated as agreed.
- Slack alert: shows the product name for ordinary, large and workshop.
- Application submit: rejects a count over the product's cap, enforces 1 to 1000 when the product has no cap, rejects an inactive product and one that cannot be applied for.

Browser checks for B: the application form and planning form in Chromium, WebKit and Firefox, and the application form in Safari in the iOS Simulator with the keyboard open.

## Blast radius

The change crosses every step from a company applying to Navet sending the invoice.

| Area | What breaks if it goes wrong | Who notices |
|---|---|---|
| Hugin application form | Companies cannot apply, or apply for the wrong product | Companies. Navet loses orders. |
| Offers and the semester plan | Wrong product shown, or a page fails to load | Navet's board |
| Event planning | Wrong student cap, or a sent invitation is invalidated or kept when it should not be | Companies and students |
| Invoicing | Wrong product or price on an invoice | Companies. It is a bookkeeping error. |
| Slack alert, Google Sheet, emails | Wrong or missing product text | Navet internally |

Risk, highest first:

| Risk | Impact | Likelihood | Handling |
|---|---|---|---|
| The application form rejects valid applications or accepts oversized ones | High | Medium | Server validates against the loaded product. Tests for cap, no cap, inactive product. Design mock for the loading state. |
| Open tabs and the old frontend call the new backend | High | Certain for a few minutes per deploy | Rule 7. Old arguments and endpoints stay one pull request longer. |
| The backfill gives an application the wrong product | High | Unknown | Rule 5 and rule 6. Prefer the sold product, report conflicts, resolve by hand. |
| Clearing a legacy field before every row is resolved | High | Low | Gates before B and C are checked against the production report. |
| Invoicing changes for an event already sold | High | Low | The event's product copy is not touched. Only the no-copy fallback changes. |
| A deploy is rejected by schema validation | Low | Low | It fails closed. Nothing is written. |

Not known: how many rows each production table holds, whether live products have a type set, and whether two active products share a type. There is no read access to production from the development machine. The report in A answers all three before anything is switched.

Timing: B should not ship while companies are applying for a semester or while invoices are going out.

## Open decisions

1. The product name on the event copy. Victor asked for events to have no stored product name. The review found that removing it reaches further than the rest of this plan: job listings share the same validator (`jobListings/schema.ts:16`), sales statistics and product tagging read it (`products/stats.ts:34`, `event-tagging.tsx:109`), pending and reopened invoices take their line text from it, and planning's fingerprint includes it. It does not help remove the enum. Recommendation: leave the copy as it is here, and decide the name in a separate change.
2. Which products a company can apply for. Today the code lists three types and leaves `social` out. "Active products in the event category" would put the seeded "Sosialt arrangement" product, which has no price and no cap, on the public form. Options: (a) a yes or no field on the product, "can be applied for", set to yes for the three current products by the backfill, or (b) archive the social product. Recommendation: (a). It is a real property of a product, and (b) would hide the product from event tagging too.
3. Social applications. Victor says none exist. The report in A will confirm it. If any do, they map to the social product like any other type.
4. Planning's capacity hint says "Ordinært og faglig arrangement er til og med 40 studenter, mens stort arrangement er mer enn 40" (`shared/events/planning.ts:28`). It hard-codes the cap in copy. Changing user-facing text needs Victor's wording.

## What the review changed

- The storage list missed planning submissions, which hold `requestedEventType` in `answers` and `draft`.
- Revision 1 said invoices store their line text at creation. They store it when marked sent and drop it when reopened.
- Revision 1 had B stop writing `eventType` while three tables still required it, and had C clear the fields and remove them from the schema in one deploy. Both would have failed. The sequence is now: add, switch and make optional, clear, remove.
- Revision 1 protected stored rows but not old browser code. Rules 7 to 9 are new.
- Revision 1 let unmappable rows stay unmapped. Rule 6 is new.
- Revision 1 mapped every row from its type to today's active product. Rule 5 is new.
- Revision 1 removed the name from the event copy. That is now open decision 1.
- The eligibility of the social product, the saved browser draft, the 1 to 1000 limit and the planning hint text are new.
- The test count was 40 lines. It is 35.

Not checked by the review or by the author: production rows, a real migration run, browser behaviour.

## Out of scope

- Changing prices, caps or product names.
- The product copy on events and job listings.
- Any change to how events are created, published or invoiced beyond where they read the product.
