"use client";

import type { api } from "@workspace/backend/convex/api";
import {
	ORGANIZATION_GUIDE_STEPS,
	ORGANIZATION_GUIDE_STORAGE_KEY,
	type OrganizationGuideStep,
} from "@workspace/shared/organization";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import type { ReactNode } from "react";
import { createGuide } from "@/components/common/guide";
import { accountStatus } from "./internals/access/access-status";

const hints: Record<OrganizationGuideStep, string> = {
	board:
		"Velg hvem som har vervet, skriv inn rollen i styret og velg tilgangsrolle. Personen må være intern fra før.",
	add: "Skriv inn navn, UiO-e-post og Navet-e-post. Bifrost lager Google-kontoen og sender innlogging og Slack-invitasjon til UiO-adressen.",
	remove:
		"Trykk her for å fjerne en intern. Google-kontoen suspenderes og tilgangen til Bifrost forsvinner med en gang.",
	slack:
		"Slack-kontoen deaktiverer du selv i Slack-admin. Trykk her når det er gjort, så forsvinner raden.",
};

const guide = createGuide({
	steps: ORGANIZATION_GUIDE_STEPS,
	storageKey: ORGANIZATION_GUIDE_STORAGE_KEY,
	hints,
});

export const { GuideHint, GuideReplay } = guide;

export function OrganizationGuide({
	preloadedInternals,
	preloadedAccess,
	isSuperAdmin,
	children,
}: Readonly<{
	preloadedInternals: Preloaded<typeof api.users.organization.queries.getAllInternals>;
	preloadedAccess: Preloaded<typeof api.iam.queries.overview>;
	isSuperAdmin: boolean;
	children: ReactNode;
}>) {
	const internals = usePreloadedQuery(preloadedInternals);
	const access = usePreloadedQuery(preloadedAccess);
	const available = new Set<OrganizationGuideStep>(["add"]);
	if (isSuperAdmin) available.add("board");
	if (internals.length > 0) available.add("remove");
	if (
		access.accounts.some((account) => accountStatus(account).actions.includes("slackDeactivated"))
	)
		available.add("slack");
	return <guide.GuideProvider available={available}>{children}</guide.GuideProvider>;
}
