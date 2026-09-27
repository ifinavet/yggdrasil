import type { Id } from "@workspace/backend/convex/dataModel";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";
import { AddUioEmail } from "./add-uio-email";
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

export function InternalDetails({
	internalId,
	connections,
}: Readonly<{ internalId: Id<"internals">; connections: Connections | null }>) {
	const uioEmail = connections?.uioEmail;
	return (
		<dl className="grid gap-x-10 gap-y-4 px-2 py-1 sm:grid-cols-3">
			<Detail label="UiO-adresse">
				{uioEmail ? (
					<span className="block truncate">{uioEmail}</span>
				) : (
					<AddUioEmail internalId={internalId} />
				)}
			</Detail>
			{connections ? (
				<>
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
				</>
			) : (
				<p className="text-pretty text-muted-foreground text-sm sm:col-span-2 sm:self-center">
					Lagt til før Bifrost opprettet kontoer, så koblingene er ukjente.
				</p>
			)}
		</dl>
	);
}
