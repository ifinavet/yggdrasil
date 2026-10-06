import { getAuthToken, hasAllRights } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { preloadQuery } from "convex/nextjs";
import AddBoardMember from "@/components/organization/board-members/add-boardmember";
import ListBoardMembers from "@/components/organization/board-members/list-board-members";
import { GuideHint, GuideReplay, OrganizationGuide } from "@/components/organization/guide";
import { InternalGroups } from "@/components/organization/internal-groups";
import Internals from "@/components/organization/internals/internals";
import UpdateMainSponsor from "@/components/organization/main-sponsor/update-main-sponsor";

export default async function OrganizationPage() {
	const token = await getAuthToken();

	const preloadedBoardMembers = await preloadQuery(
		api.users.organization.queries.getTheBoard,
		{},
		{ token },
	);
	const preloadedInternals = await preloadQuery(
		api.users.organization.queries.getAllInternals,
		{},
		{ token },
	);
	const preloadedAccess = await preloadQuery(api.iam.queries.overview, {}, { token });
	const preloadedMainSponsor = await preloadQuery(api.companies.queries.getMainSponsor);
	const isSuperAdmin = await hasAllRights();

	return (
		<OrganizationGuide
			preloadedInternals={preloadedInternals}
			preloadedAccess={preloadedAccess}
			isSuperAdmin={isSuperAdmin}
		>
			<div className="flex items-center justify-between gap-4">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>Organisasjon</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<GuideReplay />
			</div>
			<div className="grid gap-6">
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0">
					Styret
				</h2>
				<GuideHint step="board">
					<div className="w-fit justify-self-end">
						<AddBoardMember />
					</div>
				</GuideHint>
				<ListBoardMembers preloadedBoardMembers={preloadedBoardMembers} />

				<Separator />
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0">
					Interne
				</h2>
				<Internals preloadedInternals={preloadedInternals} preloadedAccess={preloadedAccess} />

				<Separator />
				<InternalGroups />

				<Separator />
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0">
					Hovedsamarbeidspartner
				</h2>
				<UpdateMainSponsor preloadedMainSponsor={preloadedMainSponsor} />
			</div>
		</OrganizationGuide>
	);
}
