export { ACCESS_RIGHTS } from "./access_levels";
export { COMPANY_CONTACT_EMAIL, JOB_LISTING_ORDER_EMAIL } from "./contact";
export {
	DEGREE_TYPES,
	DEGREE_YEARS,
	DEGREES,
	type Degree,
	degreeKey,
	degreeName,
} from "./degrees";
export { JOB_TYPES } from "./job_types";
export { LISTING_COLORS } from "./listing_colors";
export { ORGANIZER_ROLES, type OrganizerRole } from "./organizer_roles";
export { PROGRAM_DEGREES, STUDY_PROGRAMS, type StudyProgram } from "./programs";
export {
	REGISTRATION_STATUS_LABELS,
	REGISTRATION_STATUSES,
	type RegistrationStatus,
} from "./registration_statuses";
export {
	degreesFor,
	fittingDegree,
	fittingYear,
	isStudyProgram,
	refineStudentProfile,
	type StudentProfile,
	studentProfileIssue,
	yearsFor,
} from "./students";
export {
	BIFROST_LOCAL_URL,
	BIFROST_URL,
	COMPANY_FIRST_CONTACT_TEMPLATE_URL,
	EVENT_EXPENSE_TEMPLATE_URL,
	HUGIN_LOCAL_URL,
	HUGIN_URL,
	MIDGARD_LOCAL_URL,
	MIDGARD_URL,
	SLACK_API_URL,
	SLACK_CHANNEL_URL,
	UIO_STAND_GUIDELINES_URL,
} from "./urls";
export { UTM_CAMPAIGN, UTM_MEDIUM, UTM_SOURCE, type UtmTags, utmParams } from "./utm";
