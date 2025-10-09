"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import type { accessRights } from "@/constants/types";
import { createColumns } from "./columns";
import { InternalsTable } from "./internals-table";
import { NewInternal } from "./new-internal/new-internal";

export default function Internals({
	preloadedInternals,
}: Readonly<{
	preloadedInternals: Preloaded<typeof api.internals.getAllInternals>;
}>) {
	const internals = usePreloadedQuery(preloadedInternals);

	const postHog = usePostHog();

	const deleteInternal = useMutation(api.internals.removeInternal);
	const deleteInternalAction = (internalsId: Id<"internals">) =>
		deleteInternal({ id: internalsId })
			.then(() => {
				toast("Intern medlem slettet", {
					description:
						"Intern medlemmet er nå slettet. Denne handlingen kan ikke angres, og blir logget.",
				});

				postHog.capture("delete-internal-member", {
					internalId: internalsId,
				});
			})
			.catch((error) => {
				toast.error("Kunne ikke slette intern medlem", {
					description: "Denne hendelsen er logget. Skulle den vedvare ta kontakt med webansvarlig",
				});
				postHog.capture("delete-internal-member-error", {
					error: error,
					internalId: internalsId,
				});
			});

	const updateGroup = useMutation(api.internals.updateInternal);
	const updateGroupAction = (internalsId: Id<"internals">, group: string) =>
		updateGroup({ id: internalsId, group }).catch((error) => {
			toast.error("Kunne ikke oppdatere intern medlem", {
				description: "Denne hendelsen er logget. Skulle den vedvare ta kontakt med webansvarlig",
			});

			postHog.capture("update-internal-member-error", {
				error: error,
				internalId: internalsId,
				group: group,
			});
		});

	const upsertRole = useMutation(api.accsessRights.upsertAccessRights);
	const upsertRoleAction = (userId: Id<"users">, role: (typeof accessRights)[number]) =>
		upsertRole({
			userId,
			role,
		});

	const columns = createColumns(deleteInternalAction, updateGroupAction, upsertRoleAction);

	const data = internals.map((internal) => ({
		userId: internal.userId,
		internalId: internal._id,
		fullName: internal.fullName,
		email: internal.email,
		group: internal.group,
		role: internal.role as (typeof accessRights)[number],
	}));

	return (
		<div className="space-y-4">
			<NewInternal />
			<InternalsTable columns={columns} data={data} className="overflow-clip rounded-lg" />
		</div>
	);
}
