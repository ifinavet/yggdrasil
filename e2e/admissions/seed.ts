import {
	ADMISSION_SCHEDULING_DEFAULTS,
	ADMISSION_UNSURE_GROUP,
	makeSchedulingDays,
	makeSchedulingSlots,
	matchInterviews,
} from "@workspace/shared/admissions";
import { STUDY_PROGRAMS } from "@workspace/shared/constants";
import { localIdentity } from "@workspace/shared/local";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import type { Doc, Id } from "../../packages/backend/convex/_generated/dataModel";
import { LocalDatabase } from "./seed-database";

const DAY = 24 * 60 * 60 * 1000;
const seedPrefix = "seed-admissions-";
const seedGroupNames = ["Bedrift", "Web", "Promo", "Intern", "Økonomi"] as const;
const previewInterviewerImages = Array.from(
	{ length: 6 },
	(_, index) => `https://i.pravatar.cc/96?img=${index + 11}`,
);

async function localAdmissionGroups(db: LocalDatabase) {
	const groups = await Promise.all(
		seedGroupNames.map(async (name) => {
			const existing = await db.find("internalGroups", "name", name);
			const id =
				existing?._id ??
				(await db.insert("internalGroups", {
					name,
					description: `${name} arbeidsgruppe`,
				}));
			return [name, id] as const;
		}),
	);
	return new Map(groups);
}

async function localUser(db: LocalDatabase, ensureStudentProfile = true) {
	const existing = await db.find("users", "externalId", localIdentity.subject);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: localIdentity.profileUrl,
			locked: false,
		}));
	const student = await db.find("students", "userId", userId);
	if (!student && ensureStudentProfile)
		await db.insert("students", {
			userId,
			name: `${localIdentity.givenName} ${localIdentity.familyName}`,
			studyProgram: "Informatikk: programmering og systemarkitektur",
			year: 1,
			degree: "Bachelor",
		});
	if (student && !ensureStudentProfile) await db.delete("students", student._id);
	const rights = await db.find("accessRights", "userId", userId);
	if (!rights) await db.insert("accessRights", { userId, role: "super-admin" });
	return userId;
}

async function syntheticUser(db: LocalDatabase, index: number) {
	const externalId = `${seedPrefix}applicant-${index}`;
	const email = `applicant-${index}@uio.no`;
	const firstName = ["Ingrid", "Emma", "Nora", "Jakob", "Emil", "Sara"][index % 6] ?? "Student";
	const lastName = ["Hansen", "Berg", "Dahl", "Olsen", "Lie"][index % 5] ?? "Nordmann";
	const existing = await db.find("users", "externalId", externalId);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId,
			firstName,
			lastName,
			email,
			image: "",
			locked: false,
		}));
	const student = await db.find("students", "userId", userId);
	if (!student)
		await db.insert("students", {
			userId,
			name: `${firstName} ${lastName}`,
			studyProgram: STUDY_PROGRAMS[index % 8] ?? STUDY_PROGRAMS[0],
			year: (index % 5) + 1,
			degree: index % 3 ? "Bachelor" : "Master",
		});
	return { userId, firstName, lastName, email };
}

async function boardUser(db: LocalDatabase, name: string, email: string, image: string) {
	const [firstName, ...rest] = name.split(" ");
	const lastName = rest.join(" ");
	const externalId = `${seedPrefix}${email.split("@")[0]}`;
	const existing = await db.find("users", "externalId", externalId);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId,
			firstName: firstName ?? "Styremedlem",
			lastName,
			email,
			image,
			locked: false,
		}));
	if (existing) await db.patch("users", userId, { image });
	const internal = await db.find("internals", "userId", userId);
	if (!internal) await db.insert("internals", { userId, position: "Styremedlem", group: "Styret" });
	const role = await db.find("accessRights", "userId", userId);
	if (!role) await db.insert("accessRights", { userId, role: "internal" });
	return userId;
}

async function clearAdmissions(db: LocalDatabase) {
	const applicant = await db.find("users", "externalId", localIdentity.subject);
	if (applicant) {
		const membership = await db.find("internals", "userId", applicant._id);
		if (membership?.position === "Intern" && membership.group === "Web")
			await db.delete("internals", membership._id);
	}
	const account = await db.find("memberAccounts", "uioEmail", "developer@uio.no");
	if (account?.workspaceEmail === "developer@ifinavet.no")
		await db.patch("memberAccounts", account._id, {
			stage: "cancelled",
			google: "suspended",
			updatedAt: Date.now(),
		});
	const jobs = await db.all("admissionWorkflows");
	await db.clear("admissionWorkflows");
	await Promise.all(
		jobs.map(async (job) => {
			const { workflow } = await db.call(
				"workflow:getStatus",
				{ workflowId: job.workflowId },
				"workflow",
			);
			if (!workflow.runResult)
				await db.call("workflow:cancel", { workflowId: job.workflowId }, "workflow");
			await db.call("workflow:cleanup", { workflowId: job.workflowId }, "workflow");
		}),
	);
	await Promise.all(
		(
			[
				"admissionDeliveries",
				"admissionInterviews",
				"admissionApplications",
				"admissionPeriods",
			] as const
		).map((table) => db.clear(table)),
	);
}

function isoDay(at: number) {
	return formatOsloDate(at, "yyyy-MM-dd");
}

function periodTitle(at: number) {
	const month = Number(formatOsloDate(at, "M"));
	return `${month >= 7 ? "Høst" : "Vår"} ${formatOsloDate(at, "yyyy")}`;
}

export type AdmissionSeedScenario =
	| "empty"
	| "missing-profile"
	| "open"
	| "scheduled"
	| "planned"
	| "delivery-failed"
	| "decisions"
	| "offer-pending-accepted"
	| "offer-pending-declined"
	| "offer-expired";

export async function seedAdmissions(url: string, scenario: AdmissionSeedScenario) {
	const db = new LocalDatabase(url);
	await clearAdmissions(db);
	if (scenario === "empty") return null;
	const groups = await localAdmissionGroups(db);
	const now = Date.now();
	const applicantId = await localUser(db, scenario !== "missing-profile");
	const secondId = await boardUser(
		db,
		"Kristin Berg",
		"kristin.berg@ifinavet.no",
		previewInterviewerImages[0] ?? "",
	);
	const thirdId = await boardUser(
		db,
		"Daniel Holm",
		"daniel.holm@ifinavet.no",
		previewInterviewerImages[1] ?? "",
	);
	await boardUser(
		db,
		"Aksel Nilsen",
		"aksel.nilsen@ifinavet.no",
		previewInterviewerImages[2] ?? "",
	);
	const applicationStartAt = now - DAY;
	const applicationEndAt = now + 7 * DAY;
	const interviewStartAt = now + 8 * DAY;
	const interviewEndAt = now + 15 * DAY;
	const retentionAt = interviewEndAt + 45 * DAY;
	const periodId = await db.insert("admissionPeriods", {
		title: periodTitle(now),
		applicationStartAt,
		applicationEndAt,
		interviewStartAt,
		interviewEndAt,
		retentionAt,
		status: "open",
		revision: 1,
		interviewers: [
			{ userId: secondId, selectedCalendarIds: ["navet", "timetable"] },
			{ userId: thirdId, selectedCalendarIds: ["navet", "timetable"] },
		],
		...ADMISSION_SCHEDULING_DEFAULTS,
		breaks: [],
		timezone: "Europe/Oslo",
		roundHistory: [],
		createdBy: applicantId,
		updatedBy: applicantId,
	});
	if (scenario === "missing-profile") return { periodId, applicantId, candidateCount: 0 };
	const ownDay = isoDay(interviewStartAt + 2 * DAY);
	await db.patch("users", applicantId, { email: "developer@uio.no" });
	const ownStatus = scenario === "open" ? "draft" : "submitted";
	const ownDecision = [
		"decisions",
		"offer-pending-accepted",
		"offer-pending-declined",
		"offer-expired",
	].includes(scenario)
		? "accepted"
		: "pending";
	const ownOffer: Doc<"admissionApplications">["offerStatus"] = offerScenario(scenario);
	let offerDeadline: number | undefined;
	if (ownOffer === "pending") offerDeadline = now + 3 * DAY;
	if (scenario === "offer-expired") offerDeadline = now - DAY;
	const ownId = await db.insert("admissionApplications", {
		periodId,
		userId: applicantId,
		studentProfile: {
			name: `${localIdentity.givenName} ${localIdentity.familyName}`,
			studyProgram: "Informatikk: programmering og systemarkitektur",
			year: 1,
			degree: "Bachelor",
		},
		about: "Jeg liker å bygge ting sammen med andre studenter.",
		motivation: "Jeg vil bidra i et godt fagmiljø og lære mer.",
		group: ADMISSION_UNSURE_GROUP,
		availability: [{ day: ownDay, start: 540, end: 960 }],
		consentedAt: now - 60_000,
		consentVersion: "admissions-2026-01",
		status: ownStatus,
		revision: 2,
		decisionRevision: ownDecision === "accepted" ? 1 : 0,
		decision: ownDecision,
		...(ownDecision === "accepted"
			? {
					reviewedGroup: "Web",
					reviewedGroupId: groups.get("Web"),
					reviewedWorkspaceEmail: "developer@ifinavet.no",
					decisionBy: applicantId,
					decisionAt: now - 60_000,
				}
			: {}),
		notes: "Local demo note.",
		decisionSentAt: ownOffer !== "none" ? now - 30_000 : undefined,
		decisionQueuedAt: undefined,
		offerStatus: ownOffer,
		offerDeadline,
		offerRespondedAt: ownOffer === "declined" ? now - 10_000 : undefined,
	});
	if (scenario === "scheduled" || scenario === "delivery-failed" || ownOffer !== "none") {
		await seedPublishedInterview(
			db,
			periodId,
			ownId,
			ownDay,
			[secondId, thirdId],
			scenario === "delivery-failed",
			now,
		);
	}
	await seedOtherCandidates(db, periodId, interviewStartAt, scenario === "decisions", now, groups);
	if (scenario === "planned") await seedPlannedInterviews(db, periodId);
	return { periodId, applicantId, candidateCount: 31 };
}

async function seedPublishedInterview(
	db: LocalDatabase,
	periodId: Id<"admissionPeriods">,
	applicationId: Id<"admissionApplications">,
	day: string,
	interviewerIds: Id<"users">[],
	failedDelivery: boolean,
	now: number,
) {
	const startAt = osloDateTimeToEpoch(day, "10:00");
	const interviewId = await db.insert("admissionInterviews", {
		periodId,
		applicationId,
		startAt,
		endAt: startAt + 15 * 60_000,
		interviewerIds,
		selectedCalendarIds: ["navet", "timetable"],
		room: "Beta",
		status: "scheduled",
		revision: 1,
		calendarEventId: `local:${applicationId}`,
		publishedAt: now - 30_000,
	});
	if (!failedDelivery) return;
	await db.patch("admissionPeriods", periodId, { status: "published" });
	await db.call("admissions/internal:completeDelivery", {
		operation: {
			periodId,
			applicationId,
			interviewId,
			kind: "publish",
			revision: 1,
			idempotencyKey: `seed-publish:${interviewId}`,
			dueAt: now,
		},
	});
	await Promise.all(
		(await db.all("admissionWorkflows"))
			.filter((ref) => ref.kind === "remind_3d" || ref.kind === "remind_1d")
			.map(async (ref) => {
				const { workflow } = await db.call(
					"workflow:getStatus",
					{ workflowId: ref.workflowId },
					"workflow",
				);
				await db.call(
					"workflow:complete",
					{
						workflowId: ref.workflowId,
						generationNumber: workflow.generationNumber,
						runResult: {
							kind: "failed",
							error: "E-posttjenesten svarte ikke. Prøv igjen eller følg opp manuelt.",
						},
					},
					"workflow",
				);
			}),
	);
}

async function seedOtherCandidates(
	db: LocalDatabase,
	periodId: Id<"admissionPeriods">,
	interviewStartAt: number,
	decisions: boolean,
	now: number,
	groups: ReadonlyMap<string, Id<"internalGroups">>,
) {
	await Promise.all(
		Array.from({ length: 30 }, async (_, index) => {
			const person = await syntheticUser(db, index);
			const day = isoDay(interviewStartAt + ((index % 5) + 1) * DAY);
			const decision: Doc<"admissionApplications">["decision"] = decisions
				? ((["shortlist", "rejected", "pending"] as const)[index % 3] ?? "pending")
				: "pending";
			await db.insert("admissionApplications", {
				periodId,
				userId: person.userId,
				studentProfile: {
					name: `${person.firstName} ${person.lastName}`,
					studyProgram: STUDY_PROGRAMS[index % 8] ?? STUDY_PROGRAMS[0],
					year: (index % 5) + 1,
					degree: "Bachelor",
				},
				about: `${person.firstName} liker å lage digitale løsninger.`,
				motivation: "Jeg vil bli kjent med flere i Navet.",
				group: groups.get(seedGroupNames[index % seedGroupNames.length] ?? "Web"),
				availability: index % 7 === 0 ? [] : [{ day, start: 540, end: 960 }],
				consentedAt: now - 60_000,
				consentVersion: "admissions-2026-01",
				status: "submitted",
				revision: 1,
				decisionRevision: decision === "pending" ? 0 : 1,
				decision,
				offerStatus: "none",
			});
		}),
	);
}

function offerScenario(scenario: string): Doc<"admissionApplications">["offerStatus"] {
	if (scenario === "offer-pending-declined") return "declined";
	return scenario === "decisions" ||
		scenario === "offer-pending-accepted" ||
		scenario === "offer-expired"
		? "pending"
		: "none";
}

async function seedPlannedInterviews(db: LocalDatabase, periodId: Id<"admissionPeriods">) {
	const period = await db.find("admissionPeriods", "_id", periodId);
	if (!period) throw new Error("Missing seeded period");
	const slots = makeSchedulingSlots(
		period,
		makeSchedulingDays(period.interviewStartAt, period.interviewEndAt, period.timezone),
	);
	const candidates = (await db.all("admissionApplications")).map(({ _id, availability }) => ({
		id: _id,
		availability,
	}));
	const assignments = matchInterviews(
		candidates,
		slots,
		period.interviewers.map(({ userId }) => ({
			id: userId,
			busy: [],
		})),
	).slice(0, 10);
	await Promise.all(
		assignments.map(async (assignment) => {
			const slot = slots.find((item) => item.id === assignment.slotId);
			if (!slot) throw new Error("Missing seeded slot");
			const startAt = osloDateTimeToEpoch(
				slot.day,
				`${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")}`,
			);
			await db.insert("admissionInterviews", {
				periodId,
				applicationId: assignment.candidateId as Id<"admissionApplications">,
				startAt,
				endAt: startAt + period.duration * 60000,
				interviewerIds: assignment.interviewers as Id<"users">[],
				selectedCalendarIds: ["navet", "timetable"],
				room: period.room,
				status: "scheduled",
				revision: 1,
			});
		}),
	);
}
