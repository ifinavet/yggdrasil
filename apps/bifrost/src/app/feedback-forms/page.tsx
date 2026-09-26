import { hasAdminRights } from "@workspace/auth";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
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
	if (!(await hasAdminRights())) redirect("/");
	return (
		<FeedbackForms
			intro={
				<>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>Skjemaer</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<div className="flex max-w-[68ch] flex-col gap-3">
						<h1 className="font-bold text-[2rem] leading-none tracking-[-0.02em]">Skjemaer</h1>
						<p className="rounded-lg bg-primary-light px-5 py-4 text-[15px] leading-relaxed">
							Erstatter Google Forms. Sendes automatisk ut til deltakerne etter arrangementet, når
							og til hvem styres per arrangement, ikke her. Svar er knyttet til versjonen deltakeren
							fikk, så publiser en ny versjon for å samle svar på endringer.
						</p>
					</div>
				</>
			}
		/>
	);
}
