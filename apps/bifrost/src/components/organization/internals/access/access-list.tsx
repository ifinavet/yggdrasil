"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Note } from "@workspace/ui/components/note";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import {
	CircleAlert,
	ClipboardCheck,
	Clock,
	LoaderCircle,
	type LucideIcon,
	RefreshCw,
	UserRoundSearch,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
	type AccessAccount,
	type AccessAction,
	type AccessDrift,
	type AccessOverview,
	type AccessTone,
	accountStatus,
	driftText,
	missingIntegrations,
	type OnboardingPrefill,
	prefillFromDrift,
} from "./access-status";

const TONE_ICONS: Record<AccessTone, LucideIcon> = {
	working: LoaderCircle,
	waiting: Clock,
	failed: CircleAlert,
	todo: ClipboardCheck,
};

const TONE_CLASSES: Record<AccessTone, string> = {
	working: "text-muted-foreground",
	waiting: "text-muted-foreground",
	failed: "text-[color-mix(in_oklab,var(--destructive)_82%,var(--foreground))]",
	todo: "text-[color-mix(in_oklab,var(--warning)_60%,var(--foreground))]",
};

const ACTION_LABELS: Record<AccessAction, string> = {
	retry: "Prøv igjen",
	confirmGoogle: "Bruk eksisterende konto",
	cancel: "Avbryt",
	slackDeactivated: "Slack er deaktivert",
};

function formatList(items: readonly string[]) {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} og ${items.at(-1)}`;
}

function refusal(error: unknown) {
	return error instanceof ConvexError ? String(error.data) : "Prøv igjen om litt.";
}

function Row({
	title,
	detail,
	status,
	children,
}: Readonly<{ title: string; detail?: string; status: ReactNode; children?: ReactNode }>) {
	return (
		<li className="grid gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-center">
			<div className="min-w-0">
				<p className="truncate font-medium text-sm">{title}</p>
				{detail && <p className="truncate text-muted-foreground text-xs">{detail}</p>}
			</div>
			{status}
			<div className="flex flex-wrap gap-2 md:justify-end">{children}</div>
		</li>
	);
}

function Status({
	tone,
	icon,
	text,
}: Readonly<{ tone: AccessTone; icon?: LucideIcon; text: string }>) {
	const Icon = icon ?? TONE_ICONS[tone];
	return (
		<p className={cn("flex min-w-0 items-start gap-2 text-sm", TONE_CLASSES[tone])}>
			<Icon
				aria-hidden
				className={cn("mt-0.5 size-4 flex-none", tone === "working" && "motion-safe:animate-spin")}
			/>
			<span className="text-pretty">{text}</span>
		</p>
	);
}

function AccountRow({ account }: Readonly<{ account: AccessAccount }>) {
	const status = accountStatus(account);
	const [pending, setPending] = useState<AccessAction>();
	const retry = useMutation(api.iam.mutations.retry);
	const cancel = useMutation(api.iam.mutations.cancelOnboarding);
	const markSlackDeactivated = useMutation(api.iam.mutations.markSlackDeactivated);
	const confirmGoogle = useMutation(api.iam.mutations.confirmGoogleAccount);
	const run: Record<AccessAction, (args: { accountId: Id<"memberAccounts"> }) => Promise<unknown>> =
		{
			retry,
			confirmGoogle,
			cancel,
			slackDeactivated: markSlackDeactivated,
		};

	const act = (action: AccessAction) => {
		setPending(action);
		run[action]({ accountId: account._id })
			.catch((error) =>
				toast.error(`Kunne ikke ${ACTION_LABELS[action].toLowerCase()}`, {
					description: refusal(error),
				}),
			)
			.finally(() => setPending(undefined));
	};

	return (
		<Row
			title={account.name}
			detail={account.workspaceEmail}
			status={<Status tone={status.tone} text={status.text} />}
		>
			{status.actions.map((action) => (
				<Button
					key={action}
					size="sm"
					variant={action === "cancel" ? "ghost" : "outline"}
					disabled={pending !== undefined}
					onClick={() => act(action)}
				>
					{ACTION_LABELS[action]}
				</Button>
			))}
		</Row>
	);
}

function DriftRow({
	drift,
	onAdd,
}: Readonly<{ drift: AccessDrift; onAdd: (prefill: OnboardingPrefill) => void }>) {
	const ignore = useMutation(api.iam.mutations.ignoreDrift);
	const [ignoring, setIgnoring] = useState(false);
	const prefill = prefillFromDrift(drift);

	return (
		<Row
			title={drift.name || drift.email}
			detail={drift.name ? drift.email : undefined}
			status={<Status tone="todo" icon={UserRoundSearch} text={driftText(drift)} />}
		>
			{prefill && (
				<Button
					size="sm"
					variant="outline"
					aria-label={`Legg til ${drift.email} som medlem`}
					onClick={() => onAdd(prefill)}
				>
					Legg til som medlem
				</Button>
			)}
			<Button
				size="sm"
				variant="ghost"
				disabled={ignoring}
				aria-label={`Ignorer ${drift.email}`}
				onClick={() => {
					setIgnoring(true);
					ignore({ email: drift.email }).catch((error) => {
						toast.error("Kunne ikke ignorere", { description: refusal(error) });
						setIgnoring(false);
					});
				}}
			>
				Ignorer
			</Button>
		</Row>
	);
}

function CheckNowButton({ disabled }: Readonly<{ disabled: boolean }>) {
	const checkNow = useMutation(api.iam.mutations.checkNow);
	const [checking, setChecking] = useState(false);

	return (
		<Button
			size="sm"
			variant="outline"
			disabled={disabled || checking}
			onClick={() => {
				setChecking(true);
				checkNow({})
					.then(() =>
						toast.success("Sjekker Google og Slack", {
							description: "Koblingene oppdateres om noen sekunder.",
						}),
					)
					.catch((error) =>
						toast.error("Kunne ikke starte sjekken", { description: refusal(error) }),
					)
					.finally(() => setChecking(false));
			}}
		>
			<RefreshCw aria-hidden className={cn("size-4", checking && "motion-safe:animate-spin")} />
			Sjekk Google og Slack nå
		</Button>
	);
}

export function AccessList({
	overview,
	onAdd,
}: Readonly<{ overview: AccessOverview; onAdd: (prefill: OnboardingPrefill) => void }>) {
	const missing = missingIntegrations(overview);
	const hasRows = overview.accounts.length > 0 || overview.drift.length > 0;

	return (
		<>
			<div className="flex justify-end">
				<CheckNowButton disabled={!overview.google && !overview.slack} />
			</div>
			{missing.length > 0 && (
				<Note tone="warn">
					{formatList(missing)} er ikke koblet til ennå. Bifrost legger fortsatt til personen, men
					kontoene der må du opprette og fjerne selv.
				</Note>
			)}
			{hasRows && (
				<ul
					aria-label="Tilganger som trenger oppfølging"
					className="divide-y rounded-lg border bg-card"
				>
					{overview.accounts.map((account) => (
						<AccountRow key={account._id} account={account} />
					))}
					{overview.drift.map((drift) => (
						<DriftRow key={drift._id} drift={drift} onAdd={onAdd} />
					))}
				</ul>
			)}
		</>
	);
}
