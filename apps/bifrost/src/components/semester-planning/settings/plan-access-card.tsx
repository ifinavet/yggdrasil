"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatMoment } from "../format";

type Grant = FunctionReturnType<typeof api.semesterPlanning.access.queries.list>["granted"][number];

/**
 * «Tilgang»: who sees every tab and may change the semester plan. The board always may; the board
 * can also let other internal members in, and take that away again. Everyone else sees Plan.
 */
export function PlanAccessCard({ className }: Readonly<{ className?: string }>) {
	const access = useQuery(api.semesterPlanning.access.queries.list, {});

	return (
		<Card className={cn("min-w-0 gap-4 py-4 sm:py-4.5", className)}>
			<CardHeader className="px-4 sm:px-5">
				<CardTitle className="text-base">Tilgang</CardTitle>
				<p className="text-muted-foreground text-sm">
					Styret og de styret gir tilgang ser alle fanene og kan endre semesterplanen. Andre interne
					ser bare Plan.
				</p>
			</CardHeader>
			<CardContent className="grid gap-4 px-4 sm:px-5">
				{access === undefined ? (
					<output className="text-muted-foreground text-sm">Henter tilgang …</output>
				) : (
					<>
						<section className="grid gap-1.5">
							<h3 className="font-medium text-sm">Styret</h3>
							{access.board.length === 0 ? (
								<p className="text-muted-foreground text-sm">Ingen i gruppen Styret.</p>
							) : (
								<p className="text-sm">{access.board.map((member) => member.name).join(", ")}</p>
							)}
						</section>

						<section className="grid gap-1.5">
							<h3 className="font-medium text-sm">Gitt tilgang av styret</h3>
							{access.granted.length === 0 ? (
								<p className="text-muted-foreground text-sm">Ingen andre har tilgang.</p>
							) : (
								<ul className="grid divide-y rounded-lg border">
									{access.granted.map((grant) => (
										<GrantRow
											key={grant.grantId}
											grant={grant}
											canManage={access.canManageAccess}
										/>
									))}
								</ul>
							)}
						</section>

						{access.canManageAccess && <GrantForm candidates={access.candidates} />}
					</>
				)}
			</CardContent>
		</Card>
	);
}

function GrantRow({ grant, canManage }: Readonly<{ grant: Grant; canManage: boolean }>) {
	const revoke = useMutation(api.semesterPlanning.access.mutations.revoke);
	const { error, run, clearError } = useAsyncAction();
	const [open, setOpen] = useState(false);

	return (
		<li className="flex items-center justify-between gap-3 px-3 py-2">
			<div className="min-w-0">
				<p className="truncate font-medium text-sm">{grant.name}</p>
				<p className="text-muted-foreground text-xs">
					{grant.active
						? `Gitt av ${grant.grantedBy}, ${formatMoment(grant.grantedAt, "day")}`
						: "Ikke lenger aktiv intern, så tilgangen gjelder ikke"}
				</p>
			</div>
			{canManage && (
				<>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Fjern tilgangen til ${grant.name}`}
						onClick={() => {
							clearError();
							setOpen(true);
						}}
					>
						<Trash2 />
					</Button>
					<ConfirmDialog
						open={open}
						onOpenChange={setOpen}
						title={`Fjerne tilgangen til ${grant.name}?`}
						description="Personen ser da bare Plan, som andre interne. Du kan gi tilgang igjen senere."
						confirmLabel="Fjern tilgang"
						destructive
						error={error}
						onConfirm={() =>
							run(
								() => revoke({ grantId: grant.grantId }),
								() => toast.success(`${grant.name} har ikke lenger tilgang.`),
								"Kunne ikke fjerne tilgangen.",
							)
						}
					/>
				</>
			)}
		</li>
	);
}

function GrantForm({
	candidates,
}: Readonly<{ candidates: readonly { userId: Id<"users">; name: string }[] }>) {
	const grant = useMutation(api.semesterPlanning.access.mutations.grant);
	const { pending, error, run } = useAsyncAction();
	const [userId, setUserId] = useState<string | null>(null);
	const picked = candidates.find((candidate) => candidate.userId === userId);

	return (
		<form
			className="grid gap-1.5"
			onSubmit={(event) => {
				event.preventDefault();
				if (!picked) return;
				void run(
					() => grant({ userId: picked.userId }),
					() => {
						setUserId(null);
						toast.success(`${picked.name} har fått tilgang.`);
					},
					"Kunne ikke gi tilgang.",
				);
			}}
		>
			<h3 className="font-medium text-sm">Gi tilgang</h3>
			<div className="flex flex-wrap gap-2">
				<SearchSelect
					aria-label="Intern som skal få tilgang"
					className="w-full sm:w-72"
					placeholder="Velg en intern"
					searchPlaceholder="Søk etter navn"
					emptyText="Ingen interne å velge"
					value={userId}
					onChange={(id) => setUserId(id)}
					items={candidates.map((candidate) => ({ id: candidate.userId, label: candidate.name }))}
				/>
				<Button type="submit" variant="outline" disabled={!picked || pending}>
					<UserPlus /> Gi tilgang
				</Button>
			</div>
			{error && <p className="text-destructive text-sm">{error}</p>}
		</form>
	);
}
