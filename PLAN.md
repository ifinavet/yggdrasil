# Plan: the product is the only definition of an event type

Status: plan for review. No code in this pull request.

## The problem

Two things describe what a company has bought.

1. A hard-coded enum, `EVENT_TYPES` in `packages/shared/semester/labels.ts`, with four values: `standard_presentation`, `large_presentation`, `workshop`, `social`. Hard-coded tables hang off it: `EVENT_TYPE_LABELS`, `EVENT_TYPE_SHORT_LABELS`, `EVENT_TITLE_PREFIX` and `STUDENT_CAP`.
2. The `products` table, which an admin edits in Bifrost. A product has a name, a price, a VAT rate and a student cap.

They repeat each other. `EVENT_TYPE_LABELS.standard_presentation` is "Ordinær bedriftspresentasjon", and so is the seeded product name. `STUDENT_CAP.standard_presentation` is 40, and so is the seeded product's `maxStudents`. When an admin renames a product or changes its cap, the application form, the Bifrost tables and the emails keep showing the hard-coded value.

The two are joined at runtime by a guess: "the first active product whose `eventType` matches". That lookup is written out four times.

The bug that started this: the Slack alert for a new application always says `Type: Bedriftspresentasjon`, for ordinary, large and workshop alike, because the string is hard-coded in `semesterPlanning/applications/confirmation.ts:334`.

## The decision

A product reference is the only definition of what kind of event something is. Name, price, VAT and student cap are read from the product. The enum and its four tables are deleted.

Two places keep a frozen copy, on purpose:

- An event keeps the price and VAT rate it was sold at. An invoice must use the agreed price, so editing a product later must not change what an existing event costs.
- An invoice keeps its line text. The invoicing schema already stores a line description (`invoicing/schema.ts:23`). Confirm in pull request A that it is written once at creation and never rebuilt from the product.

Everything else reads the product live. If an admin renames a product, every application, offer, plan row and email shows the new name.

## What stores a type today

The `events` table has no type field. It already carries only a product copy (`event.product`). The type is stored in these places:

| Table or object | Field | Defined in |
|---|---|---|
| `pendingCompanyApplications.form` | `eventType` | `semesterPlanning/schema.ts:111` |
| `companyApplications` | `eventType` | `semesterPlanning/schema.ts:178` |
| offers | `eventType` | `semesterPlanning/schema.ts:219` |
| `eventPlanning` | `eventType` | `events/planning/schema.ts:31` |
| `eventPlanning.answers` | `requestedEventType` | `events/planning/schema.ts:9` |
| `products` | `eventType`, index `by_eventType_and_active` | `products/schema.ts:62` |

References outside tests: 172 lines in 37 files. In tests: 40 lines in 13 files.

## Target state

| Table or object | Before | After |
|---|---|---|
| `pendingCompanyApplications.form` | `eventType` | `productId` |
| `companyApplications` | `eventType` | `productId` |
| offers | `eventType` | `productId` |
| `eventPlanning` | `eventType` | `productId` |
| `eventPlanning.answers` | `requestedEventType` | `requestedProductId` |
| `products` | `eventType` and its index | removed |
| `events.product` (the copy) | `productId`, `name`, `unitPriceOre`, `vatRate` | `productId`, `unitPriceOre`, `vatRate` |

Deleted from `packages/shared`: `EVENT_TYPES`, `EventType`, `APPLICATION_EVENT_TYPES`, `ApplicationEventType`, `EVENT_TYPE_LABELS`, `EVENT_TYPE_SHORT_LABELS`, `EVENT_TITLE_PREFIX`, `STUDENT_CAP`, `planningCapacityLimit`.

Which products a company can apply for: active products in category `event`. That replaces `APPLICATION_EVENT_TYPES`.

## What replaces each hard-coded table

| Hard-coded today | Used in | Replacement |
|---|---|---|
| `EVENT_TYPE_LABELS` | 12 files: Hugin form, receipt and offer page, Bifrost application card, edit form and planning panel, the shared planning form, the shared Zod schema, planning emails and notifications, Google Sheet row | `product.name` |
| `STUDENT_CAP` | Hugin form validation, shared Zod schema, planning capacity limit | `product.maxStudents`, where no value means no cap |
| `EVENT_TITLE_PREFIX` | one place, the Slack alert title | removed, see below |
| `EVENT_TYPE_SHORT_LABELS` | 5 Bifrost files: applications tab, distribution matrix, assign cell, plan cards, plan table | open decision 1 |
| "first active product with this type" lookup | `confirmation.ts:324`, `semesterPlanning/events.ts:138`, `invoicing/details.ts:56`, `products/queries.ts:24` | `ctx.db.get(application.productId)` |

`EVENT_TITLE_PREFIX` is used only for the title line of the Slack alert. Events are created with a placeholder title that a person fills in later. So the alert can say `Ordinær bedriftspresentasjon, FJORDKODE AS` from the product name, and no "kind" field is needed on the product. This is what allows the enum to go completely.

## Backwards compatibility

The current semester has applications, offers, planning rows and events in production. None of them may break or change meaning.

1. New fields are optional when they are added. Code that has not been switched keeps reading `eventType`, and a row without `productId` is valid.
2. Old fields stay in the schema until the last pull request. Convex rejects a deploy whose schema drops a field that rows still hold, so the order is fixed: add, backfill, switch readers, clear the old field, remove it from the schema.
3. The backfill only adds. It sets `productId` from `eventType` using the same rule the code uses today, the first active product with that type. It never overwrites a `productId` that is already set and never deletes a row.
4. A row the backfill cannot map is reported and left alone. Examples are a `social` application, or a type with no active product. The plan does not guess for them.
5. Events are not migrated. `event.product` keeps its price and VAT. The stored `name` is no longer read after pull request B, and is removed in pull request C.
6. During the transition, readers go through one helper, `productOf(ctx, row)`, which returns the product from `productId` and otherwise falls back to the old type lookup. Pull request C deletes the fallback.
7. Emails and links already sent stay valid. A pending application that a company confirms after the deploy still holds `form.eventType`. The confirm step resolves the product through the same helper.

## Pull requests

Three, so that production never holds a row the deployed code cannot read. Each one deploys on its own.

### A. Add the product reference and backfill

- Schema: optional `productId` on the pending application form, applications, offers and `eventPlanning`. Optional `requestedProductId` on planning answers.
- Writers set both fields: the old type and the new product reference.
- `productOf` helper with its fallback.
- Backfill migrations with `@convex-dev/migrations`, the same library `products/migrations.ts` uses, one per table.
- An internal query that counts rows with and without `productId` per table.
- The Slack alert reads the product name. This fixes the original bug.

Check before moving on: run the count query in production. Every row has `productId`, or is on the reported list with a reason.

### B. Switch every reader to the product

- Hugin application form: the choices come from a query of active event products with name, price and cap. The form submits `productId`. `apps/hugin/src/lib/company-application.ts` and the shared Zod schema validate the student count against the chosen product's cap. The server validates again against the product it loads, because the browser value cannot be trusted.
- Bifrost: the application card, edit form, applications tab, distribution matrix, assign cell, plan cards and plan table read the product name.
- Planning: the admin panel and the company form pick a product. The capacity limit comes from `product.maxStudents`.
- Emails, the Google Sheet row and planning notifications read the product name.
- Invoicing reads `application.productId` when the event has no product copy.
- `products.queries.eventTypePrices` is replaced by the product list query.
- Writers stop setting `eventType`.

Check: full click-through in Hugin and Bifrost against a local backend seeded with the current production shape. Chromium, WebKit and Firefox, plus Safari in the iOS Simulator with the keyboard open on the application form.

### C. Remove the old fields

- A migration clears `eventType` and `requestedEventType` from every row, and `name` from `events.product`.
- Schema: remove those fields, `products.eventType` and the index `by_eventType_and_active`. Make `productId` required where every row has one.
- Delete the enum, the four tables, `planningCapacityLimit`, the `productOf` fallback and the `eventType` argument to the seed helper.
- `products/migrations.ts` uses `STUDENT_CAP.standard_presentation` to guess a product for old events. That backfill has already run. It keeps working with the number 40 inlined as a local constant in that file, or the file is deleted if the migration is retired. Decide when writing C.

Check: the count query shows no row holding an old field before the schema change is deployed.

## Tests

- One test per backfill: maps the three types, leaves a row with `productId` untouched, reports an unmappable row and does not change it.
- `productOf`: returns the referenced product, falls back for a row without `productId`, returns nothing when neither exists.
- Slack alert: shows the product name for ordinary, large and workshop.
- Application submit: rejects a student count over the product's cap, accepts any count when the product has no cap, rejects an inactive product and a product in another category.
- Pending application confirmed after the deploy with only `form.eventType`: is received and gets a `productId`.
- Invoicing: an event with a product copy still invoices at the copied price after the product's price is edited.
- The existing 13 test files that build rows with `eventType` are updated in the pull request that changes what they exercise.

## Risks

| Risk | Handling |
|---|---|
| Production products lack `eventType`, so the backfill maps nothing | Not verified, no read access to production from the development machine. The count query in A answers it before B starts. |
| Two active products share a type, so "first" picks one arbitrarily | The backfill reports the type as ambiguous and maps nothing for it until an admin says which one. |
| An admin archives a product that applications reference | Archived products stay readable. `ctx.db.get` still returns them, so names still render. Only new applications are limited to active products. |
| A product is deleted | Check that Bifrost only archives. If hard delete exists, block it while references exist. |
| The Hugin form needs products before it can validate | It already waits on a price query, so this is the same loading state with more fields. |
| A rename changes the text of old applications | Intended, decided by Victor. Invoices keep their stored line text. |

## Open decisions

1. Short names in dense Bifrost tables. `EVENT_TYPE_SHORT_LABELS` gives "Ordinær", "Stor", "Faglig". Options: (a) show the full product name and let the cell truncate, (b) add an optional short name to the product. Recommendation: (a), since it adds no field, and revisit if the tables read badly.
2. The seeded "Sosialt arrangement" product has no price and is the only `social` type. There are no social applications. Recommendation: leave the product, drop the type with everything else.
3. Job listing orders store `productName` on the order at purchase time. That is a receipt, the same idea as the invoice line. Recommendation: leave it.

## Out of scope

- Changing prices, caps or product names.
- The product copy on job listings.
- Any change to how events are created, published or invoiced beyond where they read the product.
