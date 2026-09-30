import { directoriesDisabled, slackConfig } from "../../iam/config";

/** Explicit rollout switch; disabling pauses all channel writes, including cleanup. */
export function lifecycleEnabled() {
	return (
		process.env.SLACK_EVENT_CHANNELS_ENABLED === "true" && !directoriesDisabled() && !!slackConfig()
	);
}
