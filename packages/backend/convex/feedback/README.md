# Feedback delivery

`delivery/` connects the Bifrost event setting to Convex Workflow and a dedicated
Resend component. Existing event emails continue using their original component.

## Rollout

- Both `event.feedbackEnabled === true` and the Convex environment variable
  `FEEDBACK_EMAILS_ENABLED=true` are required to enqueue feedback mail. An absent
  variable, `false`, or any other value keeps sending off. Bifrost saves the event
  flag off by default; its localStorage preview switch only controls navigation.
- Set `HUGIN_BASE_URL` to the deployed Hugin HTTPS origin before enabling delivery.
- Configure Resend's webhook to POST delivery events to
  `https://<deployment>.convex.site/resend-webhook`, with the matching
  `RESEND_WEBHOOK_SECRET`. Signatures are verified by the Resend component.
  Enable sent, delivered, bounced and complained events; disable link tracking
  for the feedback sender so personal fragment URLs are not rewritten.
- Deploying this code does not enable either flag. Configure and verify the
  webhook before explicitly enabling production delivery.

## Lifecycle

Enabling a published, internal event schedules opening at 08:00 Europe/Oslo on
the next calendar day after the event. Enabling after that time is rejected to
avoid unexpectedly mailing historical attendees. Unpublishing, switching to an
external event, or disabling feedback cancels an active campaign. Moving an
unopened event reschedules it; old workflow steps check the generation and do
nothing. A campaign that already opened is never automatically restarted.

Opening pins the latest published version of the chosen form, or the default
form. Later edits do not change that snapshot. Registered participants marked
confirmed or late are invited; organizers, pending/waitlisted registrations,
no-shows and deleted users are excluded. The attendee list is read in batches.

Invitations send on opening, reminders on days 3, 7 and 11, and the form closes
on day 14, at the same Oslo time across daylight-saving changes. Every send
rechecks the campaign window, both flags, responses, bounces and complaints.
Rounds skipped while the master flag is off are not automatically replayed.
Workflow retries use the invitation/round delivery record to avoid duplicates.
Each delivery has a fresh token, hashed in the feedback token table; all links
belong to the same invitation and accept at most one response.

Disabling a campaign, submitting a response, or recording a bounce/complaint
cancels emails still waiting in the provider queue. Mail already handed to the
provider cannot be recalled. The master environment flag prevents new enqueues;
the event setting also triggers cancellation of its queued mail.

Workflow errors are visible in the Convex Workflow component. Closure records a
retention date; automatic retention cleanup and the new reporting UI are separate
implementation steps.

## Local verification

With `APP_ENV=local` and Convex at localhost:3210, emails are captured in
`feedbackLocalEmails` instead of sent through Resend, even when the master flag
is true. Captures contain the rendered HTML and personal URL for testing.
Hosted deployments never write those captures.

Run `pnpm --filter @workspace/backend test`. The suite uses real Workflow,
Workpool and Resend component functions, with local capture for scheduled mail.
It advances the clock through the complete campaign, exercises idempotency and
cancellation, and requires 100% coverage of the configured feedback backend files.
