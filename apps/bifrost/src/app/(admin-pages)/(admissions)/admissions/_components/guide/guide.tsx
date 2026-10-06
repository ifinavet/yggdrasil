"use client";

import { ADMISSIONS_GUIDE_STEPS, ADMISSIONS_GUIDE_STORAGE_KEY } from "@workspace/shared/admissions";
import { createGuide } from "@/components/common/guide";

export const { GuideProvider, GuideHint, GuideReplay } = createGuide({
	steps: ADMISSIONS_GUIDE_STEPS,
	storageKey: ADMISSIONS_GUIDE_STORAGE_KEY,
	hints: {
		calendars:
			"Velg hvilke Google-kalendere som gjelder for hver intervjuer, så foreslår vi ikke tider der de er opptatt.",
		generate: "Lager et forslag til intervjuplan ut fra kalenderne og intervjudagene.",
		approve:
			"Godkjenn når forslaget ser riktig ut. Da får kandidatene tiden på e-post, intervjuene legges i kalenderen og intervjuerne får beskjed i Slack.",
		candidates: "Åpne en kandidat for å lese søknaden og skrive intervjunotater fra samtalen.",
		selection:
			"Flytt kandidatene mellom kolonnene, én runde om gangen, til du vet hvem som tas opp.",
		send: "Ingen svar går ut før du trykker her. De som er tatt opp får tilbud og resten får avslag, på e-post.",
	},
});
