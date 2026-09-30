import {
	type SemesterOption,
	semesterLabel,
	semesterValue,
} from "@/components/engagement/engagement-format";

export const LIFETIME = "totalt";

export type LeaderboardScope = SemesterOption | typeof LIFETIME;

export function scopeValue(scope: LeaderboardScope) {
	return scope === LIFETIME ? LIFETIME : semesterValue(scope);
}

export function scopeLabel(scope: LeaderboardScope) {
	return scope === LIFETIME ? "Gjennom tidene" : semesterLabel(scope);
}

export function scopeArgs(scope: LeaderboardScope) {
	return scope === LIFETIME ? {} : { semester: scope };
}
