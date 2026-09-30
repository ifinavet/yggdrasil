# Event channels

The hourly lifecycle job uses the existing Slack configuration and IAM identities. No additional
configuration variable is required. Existing local/directory protection disables external actions.
Eligible upcoming events already inside the five-week window are discovered on the first run.

One private channel belongs to a company and event semester. Each event has its own welcome and
notification keys. Changing its date refreshes an unsent welcome without repeating a sent welcome.
Organizers from every event in the shared channel are invited; only bot-managed invitations can
later be removed. Missing IAM Slack identities are reported once in the company channel.

The bot needs `chat:write`, `groups:read`, `groups:write`, and `groups:history` for private channel
creation, invitations, ownership checks, notification recovery, and archival. The existing central
system channel receives only a new-channel announcement from this feature. A missing history scope
there does not prevent posting the announcement or welcoming organizers.

A channel archives seven days after both its last event and report follow-up finish. Queuing a
report email does not finish follow-up: provider confirmation does. Failed delivery and retries
keep the channel open; successful retry starts a new safety week. Campaigns closed without a form,
zero-response reports, revoked reports, and feedback-disabled events do not wait for nonexistent
report work. Existing delivered reports without timestamps begin their safety week on observation.

Slack currently does not support unarchiving with a bot token. If work reopens after archival, the
job creates an owned replacement (`-2`, `-3`, …) when work becomes actionable, keeping old history
archived. Active channels remain shared across later events in the same semester.

Durable channel generations, invite intents, leases, and message metadata recover interrupted API
calls. Before each notification, current event dates, settings, capacity, report state, and checklist
conditions are checked again. Missed timed reminders expire after their current daily window;
welcomes catch up only for upcoming events. Failed channel operations back off up to one day and
remain visible in Convex function logs. A failed central creation announcement retries independently
and does not hold up organizer messages.

Event and feedback email notices start after the first provider-confirmed recipient in each batch
or round. Their wording says sending has begun; there is no notice per recipient.
