import {
	JOB_LISTINGS_GUIDE_STEPS,
	JOB_LISTINGS_GUIDE_STORAGE_KEY,
	type JobListingsGuideStep,
} from "@workspace/shared/job-listings";
import { createGuide } from "@/components/common/guide";

const hints: Record<JobListingsGuideStep, string> = {
	orders:
		"Åpne en bestilling og se over annonsene. Godkjenner du, publiseres de og bedriften får e-post. Avviser du, skriver du en begrunnelse.",
	search: "Søket gjelder også utløpte annonser.",
	create: "Lag en annonse selv når bedriften ikke har sendt en bestilling.",
	publish:
		"Upubliserte annonser vises ikke på nettsiden. Bruk Publiser-knappen i raden når den er klar.",
	expired: "Åpne for å se annonser med utløpt frist.",
};

export const { GuideProvider, GuideHint, GuideReplay } = createGuide({
	steps: JOB_LISTINGS_GUIDE_STEPS,
	storageKey: JOB_LISTINGS_GUIDE_STORAGE_KEY,
	hints,
});
