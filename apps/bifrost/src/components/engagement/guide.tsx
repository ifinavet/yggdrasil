import {
	ENGAGEMENT_GUIDE_STEPS,
	ENGAGEMENT_GUIDE_STORAGE_KEY,
	type EngagementGuideStep,
} from "@workspace/shared/engagement/guide";
import { createGuide } from "@/components/common/guide";

const hints: Record<EngagementGuideStep, string> = {
	prognosis:
		"Prognosen viser hvor mange vi venter er påmeldt når arrangementet starter. Den sammenlignes med typisk forløp fra tidligere arrangementer.",
	select: "Trykk på et arrangement for å bytte hvilken kurve og målgruppe du ser under.",
	alerts:
		"Varsler kommer når et arrangement ligger bak, har mange avmeldinger eller ingen påmeldinger. Åpne viser kurven, Skjul fjerner varselet.",
	past: "Når arrangementet er ferdig, finner du oppmøte og sene avmeldinger under Tidligere.",
};

export const { GuideProvider, GuideHint, GuideReplay } = createGuide({
	steps: ENGAGEMENT_GUIDE_STEPS,
	storageKey: ENGAGEMENT_GUIDE_STORAGE_KEY,
	hints,
});
