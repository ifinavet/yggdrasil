import { Building2, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { formatOrgNumber } from "../format";
import type { ApplicationDetails } from "./model";
import { CardSection } from "./section";

const LINK = "inline-flex items-center gap-1 underline underline-offset-3 hover:text-foreground";

/**
 * «Bedriften», compact: the Enhetsregisteret details as they were when the company applied, and
 * its profile in Bifrost. A profile with the same org.nr. is the same company, so there is nothing
 * to link by hand; without one, the editor can create it.
 */
export function CompanyCard({ details }: Readonly<{ details: ApplicationDetails }>) {
	const { application, companyId, companyName } = details;
	const { registry } = application;
	const orgNumber = application.orgNumber.replace(/\s/g, "");

	const address = registry.businessAddress;
	const addressText = address
		? [
				address.addressLines.join(", "),
				[address.postalCode, address.city].filter(Boolean).join(" "),
			]
				.filter(Boolean)
				.join(", ")
		: undefined;
	const facts = [
		registry.industry?.description,
		registry.employeeCount !== undefined ? `${registry.employeeCount} ansatte` : undefined,
	].filter(Boolean);

	return (
		<CardSection title="Bedriften">
			<p className="font-semibold text-[15px]">{registry.name}</p>
			<p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
				{formatOrgNumber(application.orgNumber)} · {registry.organizationForm.description}
			</p>
			{facts.length > 0 && <p className="mt-2 text-[13px]">{facts.join(" · ")}</p>}
			{addressText && <p className="mt-0.5 text-[13px]">{addressText}</p>}

			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
				{companyId ? (
					<Link href={`/companies/${companyId}`} className={LINK}>
						<Building2 aria-hidden className="size-3.5" />
						{companyName ? `Profil: ${companyName}` : "Bedriftsprofil"}
					</Link>
				) : (
					<Link href="/companies/create-company" className={LINK}>
						<Plus aria-hidden className="size-3.5" />
						Opprett profil i Bifrost
					</Link>
				)}
				<a
					href={`https://virksomhet.brreg.no/nb/oppslag/enheter/${orgNumber}`}
					target="_blank"
					rel="noreferrer"
					className={LINK}
				>
					Se i brreg
					<ExternalLink aria-hidden className="size-3.25" />
				</a>
			</div>
		</CardSection>
	);
}
