"use client";

import {
	ADMISSIONS_GUIDE_STEPS,
	ADMISSIONS_GUIDE_STORAGE_KEY,
	type AdmissionsGuideStep,
} from "@workspace/shared/admissions";
import { Button } from "@workspace/ui/components/button";
import {
	Popover,
	PopoverAnchor,
	PopoverArrow,
	PopoverContent,
} from "@workspace/ui/components/popover";
import { useSeenSteps } from "@workspace/ui/hooks/use-seen-steps";
import { nextUnseenStep } from "@workspace/ui/lib/seen-steps";
import { CircleHelp } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useMemo } from "react";

const hints: Record<AdmissionsGuideStep, string> = {
	calendars:
		"Velg hvilke Google-kalendere som gjelder for hver intervjuer, så foreslår vi ikke tider der de er opptatt.",
	generate: "Lager et forslag til intervjuplan ut fra kalenderne og intervjudagene.",
	approve:
		"Godkjenn når forslaget ser riktig ut. Da får kandidatene tiden på e-post, intervjuene legges i kalenderen og intervjuerne får beskjed i Slack.",
	candidates: "Åpne en kandidat for å lese søknaden og skrive intervjunotater fra samtalen.",
	selection: "Flytt kandidatene mellom kolonnene, én runde om gangen, til du vet hvem som tas opp.",
	send: "Ingen svar går ut før du trykker her. De som er tatt opp får tilbud og resten får avslag, på e-post.",
};

type Guide = {
	active: AdmissionsGuideStep | null;
	markSeen: (step: AdmissionsGuideStep) => void;
	replay: () => void;
};

const GuideContext = createContext<Guide | null>(null);

export function GuideProvider({
	available,
	children,
}: Readonly<{ available: ReadonlySet<AdmissionsGuideStep>; children: ReactNode }>) {
	const { seen, markSeen, reset } = useSeenSteps(ADMISSIONS_GUIDE_STORAGE_KEY);
	const active = seen ? nextUnseenStep(ADMISSIONS_GUIDE_STEPS, available, seen) : null;
	const guide = useMemo(() => ({ active, markSeen, replay: reset }), [active, markSeen, reset]);
	return <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>;
}

export function GuideHint({
	step,
	children,
}: Readonly<{ step: AdmissionsGuideStep; children: ReactNode }>) {
	const guide = useContext(GuideContext);
	const textId = useId();
	const dismiss = () => guide?.markSeen(step);
	return (
		<Popover
			open={guide?.active === step}
			onOpenChange={(open) => {
				if (!open) dismiss();
			}}
		>
			<PopoverAnchor asChild data-tour={step} onClickCapture={dismiss}>
				{children}
			</PopoverAnchor>
			<PopoverContent
				aria-labelledby={textId}
				collisionPadding={16}
				className="w-64 border-primary bg-primary text-primary-foreground text-sm"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => event.preventDefault()}
			>
				<p id={textId}>{hints[step]}</p>
				<div className="mt-3 flex justify-end">
					<Button size="sm" variant="secondary" onClick={dismiss}>
						Skjønner
					</Button>
				</div>
				<PopoverArrow width={14} height={7} className="fill-primary stroke-primary" />
			</PopoverContent>
		</Popover>
	);
}

export function GuideReplay() {
	const guide = useContext(GuideContext);
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="Vis veiledningen igjen"
			title="Vis veiledningen igjen"
			onClick={() => guide?.replay()}
		>
			<CircleHelp />
		</Button>
	);
}
