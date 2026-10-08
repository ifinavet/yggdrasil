import { hasEditRights } from "@workspace/auth";
import { RightsGate } from "../rights-gate";

export default function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return <RightsGate hasRights={hasEditRights}>{children}</RightsGate>;
}
