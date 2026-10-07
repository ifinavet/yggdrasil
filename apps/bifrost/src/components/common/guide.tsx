"use client";

import { api } from "@workspace/backend/convex/api";
import type { GuideKey } from "@workspace/shared/guides";
import { Button } from "@workspace/ui/components/button";
import {
	Popover,
	PopoverAnchor,
	PopoverArrow,
	PopoverContent,
} from "@workspace/ui/components/popover";
import { nextUnseenStep } from "@workspace/ui/lib/seen-steps";
import { useMutation, useQuery } from "convex/react";
import { CircleHelp } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
} from "react";

type GuideConfig<Step extends string> = {
	steps: readonly Step[];
	storageKey: GuideKey;
	hints: Record<Step, string>;
};

type Guide<Step extends string> = {
	active: Step | null;
	markSeen: (step: Step) => void;
	replay: () => void;
};

function useSeenGuideSteps(guide: GuideKey) {
	const seen = useQuery(api.users.guides.queries.seen, { guide });
	const markSeenMutation = useMutation(api.users.guides.mutations.markSeen).withOptimisticUpdate(
		(store, { step }) => {
			const current = store.getQuery(api.users.guides.queries.seen, { guide });
			if (current && !current.includes(step))
				store.setQuery(api.users.guides.queries.seen, { guide }, [...current, step]);
		},
	);
	const resetMutation = useMutation(api.users.guides.mutations.reset).withOptimisticUpdate(
		(store) => store.setQuery(api.users.guides.queries.seen, { guide }, []),
	);
	const markSeen = useCallback(
		(step: string) => {
			if (seen && !seen.includes(step)) void markSeenMutation({ guide, step });
		},
		[guide, seen, markSeenMutation],
	);
	const reset = useCallback(() => void resetMutation({ guide }), [guide, resetMutation]);
	return { seen: seen ?? null, markSeen, reset };
}

export function createGuide<Step extends string>({ steps, storageKey, hints }: GuideConfig<Step>) {
	const GuideContext = createContext<Guide<Step> | null>(null);

	function GuideProvider({
		available,
		children,
	}: Readonly<{ available: ReadonlySet<Step>; children: ReactNode }>) {
		const { seen, markSeen, reset } = useSeenGuideSteps(storageKey);
		const active = seen ? nextUnseenStep(steps, available, seen) : null;
		const guide = useMemo(() => ({ active, markSeen, replay: reset }), [active, markSeen, reset]);
		return <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>;
	}

	function GuideHint({ step, children }: Readonly<{ step: Step; children: ReactNode }>) {
		const guide = useContext(GuideContext);
		const textId = useId();
		const dismiss = () => guide?.markSeen(step);
		const open = guide?.active === step;
		useEffect(() => {
			if (!open) return;
			document
				.querySelector(`[data-tour="${step}"]`)
				?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
		}, [open, step]);
		return (
			<Popover
				open={open}
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

	function GuideReplay() {
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

	return { GuideProvider, GuideHint, GuideReplay };
}
