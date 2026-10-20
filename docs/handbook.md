# Bifrost handbook

The internal handbook lives at `/wiki`. It extends `resources`; public Midgard pages remain in `externalPages`. All Bifrost members can read and maintain the handbook. The existing backend membership check still applies.

## Rollout

1. Deploy the backend and Bifrost together through the normal release workflow.
2. Open `/wiki` and choose **Klargjør håndboken**. The authenticated mutation imports resources in batches of ten and adds the 34 initial operational articles. It is safe to retry and never overwrites an already initialized article.
3. The existing `Hvordan holde bedpress` resource keeps its ID and shared recommendation. Revision zero contains its original HTML. Its current version becomes the short `holde-bedpress` workflow. The internal guidelines are imported without changing their HTML or policy.
4. Verify the two existing resource links and their edit links. They redirect to canonical `/wiki/[slug]` routes. Other legacy resources receive stable slugs derived from their IDs.
5. Review the initial articles with the people responsible for each routine. Imports and seeds deliberately have no human verification date. Operational articles are due every 90 days; policies every 365 days.

The production browser audit on 20 October 2026 found two resources: `Hvordan holde bedpress` and `Rettningslinjer for Interne`. The six feature tours remain and link to the handbook. The obsolete insight hint about being behind schedule was removed. Manual Google Forms, PDF report and attendance-sheet instructions leave the active bedpress guide. External Drive documents are not deleted; their historical links remain in revision zero.

## Editing and history

`resources` stores the published article and searchable plain text. `wikiDrafts` holds unpublished changes. Every explicit draft save, publication, restoration and retirement creates a `wikiRevisions` snapshot. Restoring always produces a draft. Existing saved drafts can be recovered from history after a restore. `editVersion` detects stale saves and reviews; published revision numbers may have gaps because drafts and checks also advance the edit sequence.

Slugs are immutable. Retiring requires an explanation and optionally a different published replacement. Retired content is excluded from search and shown through its history. Old addresses show the retirement notice and replacement link. Personal `wikiBookmarks` are separate from the legacy shared `favorite` flag, which is now an editorial recommendation. Old resource mutations cannot overwrite migrated articles.

Search uses the Convex `search_wiki` index over title, excerpt, aliases and extracted body text, filtered before pagination to published articles and optionally category. It supports final-term prefixes, not general typo correction. Norwegian aliases cover bedpres/bedpress, prikkesystem/prikksystem and other common vocabulary. Search and bookmark lists paginate; homepage lists are intentionally previews.

## Live facts and review detection

The editor attaches typed fact panels for products, feedback timing, attendance rules, checklist, Slack timing and published form questions. These panels read runtime constants or bounded database queries; they never read survey answers. Database changes update the panels reactively. Empty catalogs and missing published forms are reported explicitly. Facts do not alter `lastCheckedAt`.

`sources.json` maps canonical article slugs to the runtime files and feature directories on which their instructions depend. `source-versions.json` records a hash of the sorted source contents, excluding test files. After changing a watched feature, run:

```sh
node scripts/wiki-source-versions.mjs
```

Commit the generated file with the feature change. CI checks it with `--check`. Deploying a different source hash flags previously checked articles for review immediately, without rewriting their content. An editor must read the deployed behavior and explicitly mark the current article as checked. The backend rejects a check if either the article version or source version changed while it was being reviewed.

Reports of inaccurate instructions go to `wikiReports` and appear in **Oppfølging**. Closing a report is explicit and separate from checking the article. Custom articles without a source-map entry still receive scheduled review dates and error reports. Add their relevant feature paths to the source map when automatic change detection is appropriate.

## Initial coverage

This inventory follows merged code from 20 August through 20 October 2026. Linear status alone was not treated as proof of release.

| Area | Handbook articles | Implementation evidence |
| --- | --- | --- |
| Bedpress ordering, confirmation and semester allocation | bedriftssoknader, semesterplan | PRs #296–306, #319, #330–332, #339–341, #379, #381, #497; deletion protection #471 |
| Company planning and private form | planlegge-med-bedriften | #420 |
| Advertisement orders, receipts and billing details | annonsebestilling, bestillingsskjema | #338, #347, #353, #400, #403, #408, #495 |
| Company search and timeline | bedriftshistorikk | #411, #413, #414 |
| Event editing, lists and external links | publisere-arrangement | #205, #326, #346 |
| Shared event checklist | sjekkliste | #412 |
| Waitlist and student offers | pameldinger-venteliste | #262, #287, #385, #469 |
| Attendance, corrected penalties and lockout explanation | oppmote-prikker, studenthjelp | #228, #383, #386 |
| Reviewed student reminders and delivery | paminnelse-epost | #382 superseded by #483 |
| Automatic feedback, reminders, late attendance and organizer exclusion | tilbakemeldinger | #293, #297–309, #318, #324, #362, #445, #467, #498 |
| Feedback editor, versions and testsending | lage-skjema | #313, #314, #324 |
| Live internal report and approved company report | bedriftsrapport | #378, #396, #473, #485 |
| Products, snapshots, historical sales and prices | produkter, salg-priser | #337, #345, #408 |
| Manual Fiken invoicing and tracked sent state | fakturering | #358, #408, #456; current implementation supersedes the old automatic-Fiken issue title |
| Slack channels and operational reminders | slack-varsler | #410, #415, #418, #419, #430, #474, #485 |
| Google provisioning, onboarding, offboarding and reconciliation | medlemskontoer, kontosynk | #354, #397, #427 |
| Admissions, calendars, scheduling, offers and onboarding | opptaksperiode, intervjuer, opptaksbeslutninger | #428, #494 |
| Forecasts, comparisons, audience and alerts | prognoser, sammenligne-innsikt | #351, #352, #363, #421, #422, #436–443, #475, #479, #482 |
| Food catalog and food insights | praktisk-arrangement, sammenligne-innsikt | #369, #393, #445; separate food admin remains preview-gated |
| Leaderboard | leaderboard | #370 |
| Student calendar, graduate profile and registration fixes | studenthjelp | #361, #388, #438, #496, #499 |
| Existing manual operations and public content | utlegg, offentlige-sider, finn-frem, oppdatere-handboken, epost-feilsoking | Current code and live resource audit |

Do not describe the planned company portal, digital expense processing, universal form builder, automated room booking or Fiken API sending as available features. The handbook clearly distinguishes actions people perform from system automation.

Related Linear work: [WEB-107](https://linear.app/ifinavet/issue/WEB-107/resources-wiki-search-personal-favourites-owner-and-last-updated), [WEB-104](https://linear.app/ifinavet/issue/WEB-104/help-text-for-every-bifrost-feature), and the [operations map](https://linear.app/ifinavet/document/operations-map-a86fd1b48fda).

## Verification

Backend tests cover draft isolation, search and pagination, authentication, optimistic concurrency, revisions, bookmarks, source drift, retirement, reports, source links, reactive product facts and lossless migration. Browser tests in `e2e/admissions/board-handbook.spec.ts` exercise publishing, alias search, bookmarks, reports, retirement and mobile themes against an isolated local backend. They use the existing Playwright board project and local-only URL guard.

```sh
pnpm --dir packages/backend exec vitest run convex/wiki/wiki.test.ts --coverage.enabled=false
BIFROST_URL=http://localhost:3021 pnpm exec playwright test board-handbook --project=board
node scripts/wiki-source-versions.mjs --check
```
