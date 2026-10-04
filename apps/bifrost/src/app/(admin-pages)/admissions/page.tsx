import { isLocalDevelopment } from "@workspace/auth/local";
import { notFound } from "next/navigation";
import AdmissionsPreview from "@/components/admissions/preview";
export default function AdmissionsPage() {
	if (!isLocalDevelopment) notFound();
	return <AdmissionsPreview />;
}
