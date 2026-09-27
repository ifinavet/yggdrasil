import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";
import { GoogleMark, SlackMark } from "./brand-marks";
import {
	type ConnectionState,
	type Connections,
	googleConnection,
	slackConnection,
} from "./connections";

function Detail({ label, children }: Readonly<{ label: ReactNode; children: ReactNode }>) {
	return (
		<div className="grid min-w-0 content-start gap-1">
			<dt className="flex items-center gap-2 text-muted-foreground text-xs">{label}</dt>
			<dd className="min-w-0 text-sm">{children}</dd>
		</div>
	);
}

function State({ state }: Readonly<{ state: ConnectionState }>) {
	return (
		<span className={cn("text-pretty", !state.connected && "text-muted-foreground")}>
			{state.text}
		</span>
	);
}

export function InternalDetails({ connections }: Readonly<{ connections: Connections | null }>) {
	if (!connections) {
		return (
			<p className="px-2 py-1 text-muted-foreground text-sm">
				Lagt til før Bifrost opprettet kontoer, så koblingene er ukjente.
			</p>
		);
	}
	return (
		<dl className="grid gap-x-10 gap-y-4 px-2 py-1 sm:grid-cols-3">
			<Detail label="UiO-adresse">
				<span className="block truncate">{connections.uioEmail ?? "Ikke registrert"}</span>
			</Detail>
			<Detail
				label={
					<>
						<GoogleMark aria-hidden className="size-3.5" />
						Google Workspace
					</>
				}
			>
				<State state={googleConnection(connections)} />
			</Detail>
			<Detail
				label={
					<>
						<SlackMark aria-hidden className="size-3.5" />
						Slack
					</>
				}
			>
				<State state={slackConnection(connections)} />
			</Detail>
		</dl>
	);
}
