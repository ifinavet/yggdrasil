import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { Callout } from "@workspace/ui/components/products/callout";
import Link from "next/link";
import type { ReactNode } from "react";
import { daysList, formatMoment } from "../format";
import { StatusIcon } from "../status-badge";
import { UnfinalizePlanButton } from "./finalize-plan-button";

function Banner({
	status,
	action,
	children,
}: Readonly<{
	status: "new_date_requested" | "confirmed";
	action?: ReactNode;
	children: ReactNode;
}>) {
	return (
		<output className="block">
			<Callout
				tone={status === "new_date_requested" ? "warning" : "info"}
				icon={<StatusIcon status={status} />}
				action={action}
				className="text-[13.5px]"
			>
				{children}
			</Callout>
		</output>
	);
}

/** Whether the plan is finished, and which companies want another date. */
export function DistributionBanners({
	semester,
	finalizedByName,
	newDateRequests,
	requestedDates,
}: Readonly<{
	semester: Doc<"semesters">;
	/** Who finished the plan, if anyone. */
	finalizedByName: string | null;
	newDateRequests: readonly Doc<"companyApplications">[];
	/** The dates each company asked for instead of its offer. */
	requestedDates: ReadonlyMap<Id<"companyApplications">, string[]>;
}>) {
	return (
		<>
			{semester.planFinalizedAt !== undefined && (
				<Banner
					status="confirmed"
					action={semester.status !== "closed" && <UnfinalizePlanButton semester={semester} />}
				>
					Planen ble ferdigstilt {formatMoment(semester.planFinalizedAt, "longDay")}
					{finalizedByName ? ` av ${finalizedByName}` : ""}.
					{semester.status === "closed" && " Søknadene er stengt."}
				</Banner>
			)}
			{newDateRequests.map((application) => {
				const requested = requestedDates.get(application._id) ?? [];
				return (
					<Banner key={application._id} status="new_date_requested">
						<Link
							href={`/semesterplan/soknad/${application._id}`}
							className="font-semibold underline-offset-2 hover:underline"
						>
							{application.registry.name}
						</Link>{" "}
						ber om en annen dato
						{requested.length > 0
							? `: ${daysList(requested)}. Datoene er markert i raden.`
							: ". Tildel en ny dato og send nytt tilbud."}
					</Banner>
				);
			})}
		</>
	);
}
