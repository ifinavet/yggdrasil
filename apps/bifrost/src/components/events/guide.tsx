"use client";

import {
	EVENT_GUIDE_STEPS,
	EVENT_GUIDE_STORAGE_KEY,
	EVENTS_LIST_GUIDE_STEPS,
	EVENTS_LIST_GUIDE_STORAGE_KEY,
} from "@workspace/shared/events/guide";
import { createGuide } from "@/components/common/guide";

export const {
	GuideProvider: EventsListGuideProvider,
	GuideHint: EventsListGuideHint,
	GuideReplay: EventsListGuideReplay,
} = createGuide({
	steps: EVENTS_LIST_GUIDE_STEPS,
	storageKey: EVENTS_LIST_GUIDE_STORAGE_KEY,
	hints: {
		search:
			"Søk på tittel, bedrift eller hovedansvarlig. Listene filtreres mens du skriver, og Gjennomført åpnes når det finnes treff.",
		semester:
			"Listen viser ett semester om gangen. Velg et annet semester for å finne eldre arrangementer.",
		create:
			"Lag et nytt arrangement. Lagre lagrer det uten å publisere, Lagre og publiser gjør det synlig for studentene.",
		mine: "Her ligger arrangementene der du er ansvarlig eller medansvarlig, med rollen din på kortet. Åpne et kort for å administrere det.",
		past: "Arrangementer som er over, ligger i denne mappen. Åpne den for å se dem og status på tilbakemeldingene.",
	},
});

export const {
	GuideProvider: EventGuideProvider,
	GuideHint: EventGuideHint,
	GuideReplay: EventGuideReplay,
} = createGuide({
	steps: EVENT_GUIDE_STEPS,
	storageKey: EVENT_GUIDE_STORAGE_KEY,
	hints: {
		checklist:
			"Sjekklisten har fem faser fra planlegging til etterarbeid. Huk av oppgaver når de er gjort, så ser de andre arrangørene hva som gjenstår.",
		registrations:
			"Åpne Påmeldte for å se påmeldte og venteliste, og for å registrere oppmøte per person eller med QR-skanner.",
		email:
			"Send e-post åpner e-postprogrammet ditt med alle påmeldte i skjult kopi. Kopier epost listen legger adressene på utklippstavlen.",
		report:
			"Rapporten viser påmeldte fordelt på grad og studieretning, og tilbakemeldingene etter arrangementet.",
	},
});
