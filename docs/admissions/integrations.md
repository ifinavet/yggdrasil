# Admissions integrations

Admissions calendar publishing uses the existing Google service account and domain-wide delegation. Enable the Google Calendar API and authorize the service account in the Workspace Admin console to impersonate each selected interviewer. The default scopes are:

```text
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.freebusy
```

Set `GOOGLE_CALENDAR_SCOPES` to a space-separated scope list only when the Workspace authorization uses a different approved set. The service account still uses `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, and `GOOGLE_WORKSPACE_ADMIN_EMAIL`. Calendar reads and writes run as the selected interviewer, so their calendars must be shared with that Workspace identity as appropriate. A selected calendar that cannot be read blocks publication and reports a retryable error.

Admissions Slack delivery uses the existing `SLACK_BOT_TOKEN`. The bot needs access to create and manage private channels, look up workspace users by email, invite members, and post messages. The admissions channel name is derived from the application start date, for example `h26-opptak`, without linking admissions data to a semester record. It contains interviewers only. Notices omit applications, answers, and reviewer notes. Closing a period archives its private channel.

Admissions email uses the existing Resend configuration behind `trackedEmail`, with the same `/resend-webhook` callback used for delivery events. Local Convex deployments capture deterministic local delivery IDs and never call Google, Slack, or Resend.
