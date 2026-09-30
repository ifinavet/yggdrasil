"use client";

import { api } from "@workspace/backend/convex/api";
import { eventSemesterOf } from "@workspace/shared/time";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { HammerIcon, type LucideIcon, PartyPopperIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { tinted } from "@/components/common/chart-colors";
import { startedSemesters } from "@/components/engagement/engagement-format";
import { useMinute } from "@/hooks/use-minute";
import { useStableQuery } from "@/hooks/use-stable-query";
import {
	type LeaderboardScope,
	LIFETIME,
	scopeArgs,
	scopeLabel,
	scopeValue,
} from "./leaderboard-scope";

const ATTENDED_COLOR = "var(--leaderboard-navet)";
const ORGANIZED_COLOR = "var(--series-external)";

type Board = FunctionReturnType<typeof api.leaderboard.queries.internals>["attended"];

function ScopeSelect({
	now,
	scope,
	onChange,
}: Readonly<{
	now: number;
	scope: LeaderboardScope;
	onChange: (scope: LeaderboardScope) => void;
}>) {
	const semesters = useQuery(api.events.queries.getPossibleSemesters);
	const options: LeaderboardScope[] = [
		...(semesters ? startedSemesters(semesters, now) : [eventSemesterOf(now)]),
		LIFETIME,
	];

	return (
		<Select
			value={scopeValue(scope)}
			onValueChange={(value) => {
				const option = options.find((candidate) => scopeValue(candidate) === value);
				if (option) onChange(option);
			}}
		>
			<SelectTrigger size="sm" aria-label="Periode">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={scopeValue(option)} value={scopeValue(option)}>
						{scopeLabel(option)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

const MEDALS = [
	{ color: "oklch(0.84 0.15 88)", height: "h-24", emoji: "🥇" },
	{ color: "oklch(0.83 0.02 255)", height: "h-20", emoji: "🥈" },
	{ color: "oklch(0.72 0.11 55)", height: "h-16", emoji: "🥉" },
] as const;
const MEDAL_TEXT = "oklch(0.26 0.03 60)";
const PODIUM_ORDER = [1, 0, 2];

const ink = (color: string) => `color-mix(in oklch, ${color} 55%, var(--foreground))`;

type Entry = Board[number];

function Podium({ entries }: Readonly<{ entries: Entry[] }>) {
	return (
		<ol className="grid grid-cols-3 items-end gap-2">
			{[0, 1, 2].map((place) => {
				const entry = entries[place];
				const medal = MEDALS[place] as (typeof MEDALS)[number];
				if (!entry)
					return <li key={place} aria-hidden style={{ order: PODIUM_ORDER.indexOf(place) }} />;
				return (
					<li
						key={entry.userId}
						className="flex min-w-0 flex-col items-center gap-1.5 text-center"
						style={{ order: PODIUM_ORDER.indexOf(place) }}
					>
						{place === 0 && (
							<span className="text-3xl leading-none motion-safe:animate-bounce" aria-hidden>
								👑
							</span>
						)}
						<Avatar
							className="size-11 ring-2 ring-offset-2 ring-offset-card"
							style={{ "--tw-ring-color": medal.color } as CSSProperties}
						>
							<AvatarImage src={entry.image} alt="" />
							<AvatarFallback className="font-semibold">{entry.name.slice(0, 1)}</AvatarFallback>
						</Avatar>
						<span className="w-full truncate font-medium text-sm">{entry.name}</span>
						<div
							className={`flex w-full flex-col items-center justify-center rounded-t-md ${medal.height}`}
							style={{ background: medal.color, color: MEDAL_TEXT }}
						>
							<span className="font-bold text-2xl tabular-nums leading-none">{entry.count}</span>
							<span
								className="mt-1 text-2xl leading-none"
								role="img"
								aria-label={`${entry.rank}. plass`}
							>
								{medal.emoji}
							</span>
						</div>
					</li>
				);
			})}
		</ol>
	);
}

function Chasers({
	entries,
	top,
	color,
}: Readonly<{ entries: Entry[]; top: number; color: string }>) {
	return (
		<ol className="grid gap-1" start={4}>
			{entries.map((entry) => (
				<li
					key={entry.userId}
					className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
				>
					<span
						className="flex size-7 items-center justify-center rounded-full font-semibold text-xs tabular-nums"
						style={{ background: tinted(color, 22), color: ink(color) }}
					>
						{entry.rank}
					</span>
					<div className="grid min-w-0 gap-1">
						<span className="truncate text-sm">{entry.name}</span>
						<ShareBar share={(entry.count / top) * 100} color={color} />
					</div>
					<span className="font-semibold text-sm tabular-nums">{entry.count}</span>
				</li>
			))}
		</ol>
	);
}

function BoardBody({ board, color }: Readonly<{ board: Board | undefined; color: string }>) {
	if (!board) {
		return (
			<PanelBody>
				<Skeleton className="h-72 w-full" />
			</PanelBody>
		);
	}
	if (!board.length) {
		return (
			<PanelBody className="grid h-48 place-items-center">
				<PanelNote>🦗 Ingen her ennå. Pallen står og venter.</PanelNote>
			</PanelBody>
		);
	}
	const top = board[0]?.count ?? 1;
	const rest = board.slice(3);
	return (
		<PanelBody className="grid gap-5">
			<div className="rounded-lg px-3 pt-4" style={{ background: tinted(color, 10) }}>
				<Podium entries={board.slice(0, 3)} />
			</div>
			{rest.length > 0 && <Chasers entries={rest} top={top} color={color} />}
		</PanelBody>
	);
}

function BoardTitle({
	icon: Icon,
	color,
	children,
}: Readonly<{ icon: LucideIcon; color: string; children: string }>) {
	return (
		<span className="flex items-center gap-2.5">
			<span
				className="flex size-8 items-center justify-center rounded-md"
				style={{ background: tinted(color, 22), color: ink(color) }}
			>
				<Icon className="size-4" aria-hidden />
			</span>
			{children}
		</span>
	);
}

export function LeaderboardView() {
	const now = useMinute();
	const [scope, setScope] = useState<LeaderboardScope>(() => eventSemesterOf(now));
	const boards = useStableQuery(
		api.leaderboard.queries.internals,
		{ now, ...scopeArgs(scope) },
		scopeValue(scope),
	);

	return (
		<div className="grid gap-4 [--leaderboard-navet:var(--primary)] dark:[--leaderboard-navet:oklch(0.72_0.11_265)]">
			<div className="flex justify-end">
				<ScopeSelect now={now} scope={scope} onChange={setScope} />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<Panel
					title={
						<BoardTitle icon={PartyPopperIcon} color={ATTENDED_COLOR}>
							Navet sine bedpres-krigere🪖
						</BoardTitle>
					}
					description="Antall oppmøte på bedpres"
				>
					<BoardBody board={boards?.attended} color={ATTENDED_COLOR} />
				</Panel>
				<Panel
					title={
						<BoardTitle icon={HammerIcon} color={ORGANIZED_COLOR}>
							MVPs🐐
						</BoardTitle>
					}
					description="Antall arrangert (hovedansvarlig / medhjelper)"
				>
					<BoardBody board={boards?.organized} color={ORGANIZED_COLOR} />
				</Panel>
			</div>
		</div>
	);
}
