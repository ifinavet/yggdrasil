import { hasAllRights } from "@workspace/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FeedbackForms } from "@/components/feedback/feedback-forms";

export default function Page() {
	return (
		<Suspense fallback={<p>Henter skjemaer …</p>}>
			<AuthorizedForms />
		</Suspense>
	);
}
async function AuthorizedForms() {
	if (!(await hasAllRights())) redirect("/");
	return (
		<>
			<h1 className="font-bold text-2xl">Tilbakemeldingsskjemaer</h1>
			<FeedbackForms />
		</>
	);
}
