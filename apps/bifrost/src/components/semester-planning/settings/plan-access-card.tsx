"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PlanAccessCard({ className }: Readonly<{ className?: string }>) {
	const rights = useQuery(api.semesterPlanning.access.myRights, {});
	const internals = useQuery(api.users.organization.queries.getAll);
	const grants = useQuery(api.semesterPlanning.access.listGrants, {});
	const grant = useMutation(api.semesterPlanning.access.grant);
	const revoke = useMutation(api.semesterPlanning.access.revoke);
	const { run } = useAsyncAction((message) => toast.error(message));

	if (!rights || !internals || !grants) return null;

	const nameOf = (userId: string) =>
		internals.find((internal) => internal.userId === userId)?.fullName ?? "Ukjent bruker";
	const board = internals.filter((internal) => internal.group === "Styret");
	const candidates = internals.filter(
		(internal) =>
			internal.group !== "Styret" && !grants.some((row) => row.userId === internal.userId),
	);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="text-base">Tilgang</CardTitle>
				<p className="text-muted-foreground text-sm">
					Styret og de styret gir tilgang ser alle fanene og kan endre semesterplanen. Andre interne
					ser bare Plan.
				</p>
			</CardHeader>
			<CardContent className="grid gap-3 text-sm">
				<p>
					<span className="font-medium">Styret: </span>
					{board.map((internal) => internal.fullName).join(", ") || "Ingen"}
				</p>
				<ul className="grid gap-1">
					{grants.map((row) => (
						<li key={row._id} className="flex items-center justify-between gap-3">
							{nameOf(row.userId)}
							{rights.canManageAccess && (
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Fjern tilgangen til ${nameOf(row.userId)}`}
									onClick={() => run(() => revoke({ grantId: row._id }))}
								>
									<Trash2 />
								</Button>
							)}
						</li>
					))}
				</ul>
				{rights.canManageAccess && (
					<SearchSelect
						aria-label="Gi tilgang"
						className="w-full sm:w-72"
						placeholder="Gi tilgang til en intern"
						value={null}
						onChange={(userId) => userId && run(() => grant({ userId: userId as Id<"users"> }))}
						items={candidates.map((internal) => ({
							id: internal.userId,
							label: internal.fullName,
						}))}
					/>
				)}
			</CardContent>
		</Card>
	);
}
