"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import type { ACCESS_RIGHTS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { SearchField } from "@workspace/ui/components/search-field";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { Plus } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/common/tables/table";
import { GuideHint } from "../guide";
import { AccessList } from "./access/access-list";
import type { OnboardingPrefill } from "./access/access-status";
import { createColumns } from "./columns";
import { InternalDetails } from "./internal-details";
import { filterMembers } from "./member-search";
import { OnboardMemberDialog } from "./onboard-member/onboard-member-dialog";

export default function Internals({
	preloadedInternals,
	preloadedAccess,
}: Readonly<{
	preloadedInternals: Preloaded<typeof api.users.organization.queries.getAllInternals>;
	preloadedAccess: Preloaded<typeof api.iam.queries.overview>;
}>) {
	const internals = usePreloadedQuery(preloadedInternals);
	const access = usePreloadedQuery(preloadedAccess);
	const [search, setSearch] = useState("");
	const [onboarding, setOnboarding] = useState<{ prefill: OnboardingPrefill | null }>();

	const postHog = usePostHog();

	const deleteInternal = useMutation(api.users.organization.mutations.removeInternal);
	const deleteInternalAction = (internalsId: Id<"internals">) =>
		deleteInternal({ id: internalsId })
			.then(() => {
				toast("Personen er fjernet", {
					description: "Google-kontoen suspenderes. Husk å deaktivere Slack-kontoen.",
				});

				postHog.capture("delete-internal-member", {
					internalId: internalsId,
				});
			})
			.catch((error) => {
				toast.error("Kunne ikke fjerne personen", {
					description: "Denne hendelsen er logget. Skulle den vedvare ta kontakt med webansvarlig",
				});
				postHog.capture("delete-internal-member-error", {
					error: error,
					internalId: internalsId,
				});
			});

	const updateGroup = useMutation(api.users.organization.mutations.updateInternal);
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

	const upsertRole = useMutation(api.auth.accessRights.upsertAccessRights);
	const upsertRoleAction = (userId: Id<"users">, role: (typeof ACCESS_RIGHTS)[number]) =>
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
		role: internal.role as (typeof ACCESS_RIGHTS)[number],
		connections: internal.connections,
	}));

	return (
		<div className="grid gap-4">
			<GuideHint step="add">
				<Button className="w-fit justify-self-end" onClick={() => setOnboarding({ prefill: null })}>
					<Plus aria-hidden />
					Legg til medlem
				</Button>
			</GuideHint>
			<AccessList overview={access} onAdd={(prefill) => setOnboarding({ prefill })} />
			<SearchField
				value={search}
				onChange={setSearch}
				placeholder="Navn, Navet-e-post eller UiO-e-post"
				className="sm:w-96"
			/>
			<DataTable
				columns={columns}
				data={filterMembers(data, search)}
				empty_message={search.trim() ? "Fant ingen medlemmer som passer søket." : undefined}
				className="overflow-clip rounded-lg"
				renderExpanded={(row) => (
					<InternalDetails
						internalId={row.original.internalId}
						connections={row.original.connections}
					/>
				)}
			/>
			<OnboardMemberDialog
				open={onboarding !== undefined}
				onOpenChange={(open) => {
					if (!open) setOnboarding(undefined);
				}}
				prefill={onboarding?.prefill ?? null}
				domain={access.domain}
			/>
		</div>
	);
}
