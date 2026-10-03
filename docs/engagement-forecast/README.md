# Registration forecast preview

From `packages/backend`, run `pnpm exec convex run engagement/forecastSeed:seed` against a local backend, then open Bifrost `/insight`. The local-only seed creates registration logs and matching registrations for recovery, continued cancellation, and insufficient-history examples. It does not send emails. Re-running it leaves existing examples unchanged.

The forecast adds the historical **signed net change** to the current seat count at each future point. Counts stay between zero and capacity. Historical timelines align registration opening, the configured reminder windows (recorded queue times when available), and event start. This alignment does not manufacture a cancellation effect.

At least three historical events are required. With three or more company events, the company's median trajectory takes precedence; otherwise the existing company/pool weighting is retained. Empty or truncated log histories are excluded. The chart overlays queued or provider-confirmed reminder dispatches and future scheduled reminders. “Utsending startet” means at least one provider-confirmed send, not delivery to every recipient.

These are deterministic synthetic examples, not validation of predictive accuracy. Older backfilled logs may lack deleted cancellations. The model does not capture every factor influencing demand, and its accuracy still needs evaluation against held-out real events. It predicts registrations, not attendance.
