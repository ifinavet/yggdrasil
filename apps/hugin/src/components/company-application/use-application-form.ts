import { revalidateLogic, useForm } from "@tanstack/react-form";
import type { ApplicationForm } from "@workspace/shared/semester/application";
import {
	type ApplicationDraft,
	applicationSubmissionSchema,
	validateApplicationDraft,
} from "@/lib/company-application";

/**
 * The application form's state. Nothing is marked wrong while the company fills it in; the shared
 * schema first runs on «Send søknad», and from then on after every change, so a fixed answer
 * clears its message straight away.
 */
export function useApplicationForm({
	defaultValues,
	onSubmit,
	onSubmitInvalid,
}: {
	defaultValues: ApplicationDraft;
	onSubmit: (application: ApplicationForm, draft: ApplicationDraft) => Promise<void>;
	onSubmitInvalid: (draft: ApplicationDraft) => void;
}) {
	return useForm({
		defaultValues,
		validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
		validators: { onDynamic: validateApplicationDraft },
		onSubmit: ({ value }) => onSubmit(applicationSubmissionSchema.parse(value), value),
		onSubmitInvalid: ({ value }) => onSubmitInvalid(value),
	});
}

export type ApplicationFormApi = ReturnType<typeof useApplicationForm>;
