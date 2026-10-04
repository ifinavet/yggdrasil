import { isLocalDevelopment } from "@workspace/auth/local";
import { Suspense } from "react";
import AdmissionsDashboard from "@/components/admissions/dashboard";
import AdmissionsPreview from "@/components/admissions/preview";

async function AdmissionsContent({
	searchParams,
}: Readonly<{ searchParams: Promise<{ preview?: string }> }>) {
	const { preview } = await searchParams;
	return isLocalDevelopment && preview === "fixture" ? (
		<AdmissionsPreview />
	) : (
		<AdmissionsDashboard />
	);
}

export default function AdmissionsPage(
	props: Readonly<{ searchParams: Promise<{ preview?: string }> }>,
) {
	return (
		<Suspense fallback={<output>Laster opptaket…</output>}>
			<AdmissionsContent {...props} />
		</Suspense>
	);
}
