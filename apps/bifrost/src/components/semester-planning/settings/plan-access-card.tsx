"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export function PlanAccessCard({ className }: Readonly<{ className?: string }>) {
	const rights = useQuery(api.semesterPlanning.access.myRights, {});
	const internals = useQuery(api.users.organization.queries.getAll);
	const setPlanners = useMutation(api.semesterPlanning.access.setPlanners);
	const { run } = useAsyncAction((message) => toast.error(message));

	if (!rights || !internals) return null;
	const others = internals.filter((internal) => internal.group !== "Styret");

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="text-base">Tilgang</CardTitle>
				<p className="text-muted-foreground text-sm">
					Styret og de styret gir tilgang ser alle fanene og kan endre semesterplanen. Andre interne
					ser bare Plan.
				</p>
			</CardHeader>
			<CardContent>
				<SearchSelect
					multiple
					aria-label="Interne med tilgang"
					className="w-full sm:w-96"
					placeholder="Ingen utenfor styret"
					disabled={!rights.canManageAccess}
					value={others
						.filter((internal) => internal.semesterPlanAccess)
						.map((internal) => internal._id)}
					onChange={(ids) => run(() => setPlanners({ internalIds: ids as Id<"internals">[] }))}
					items={others.map((internal) => ({ id: internal._id, label: internal.fullName }))}
				/>
			</CardContent>
		</Card>
	);
}
