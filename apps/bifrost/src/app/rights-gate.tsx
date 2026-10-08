import { Skeleton } from "@workspace/ui/components/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type RightsGateProps = Readonly<{
	hasRights: () => Promise<boolean>;
	children: React.ReactNode;
}>;

async function RightsCheck({ hasRights, children }: RightsGateProps) {
	return (await hasRights()) ? children : redirect("/");
}

export function RightsGate({ hasRights, children }: RightsGateProps) {
	return (
		<Suspense fallback={<Skeleton className="h-96 w-full" />}>
			<RightsCheck hasRights={hasRights}>{children}</RightsCheck>
		</Suspense>
	);
}
