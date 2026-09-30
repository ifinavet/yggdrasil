import { directoriesDisabled, slackConfig } from "../../iam/config";

/** Uses the existing Slack configuration and local-development protection. */
export function lifecycleEnabled() {
	return !directoriesDisabled() && !!slackConfig();
}
