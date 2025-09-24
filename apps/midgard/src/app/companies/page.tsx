import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import InformationGrid from "@/components/companies/information-grid";
import OfferGrid from "@/components/companies/offer-grid";
import JobListingBanner from "@/components/job-listings/job-listing-banner";

export const metadata: Metadata = {
	title: "For bedrifter",
};

export default async function CompaniesPage() {
	const companyContact = await fetchQuery(api.internals.getBoardMemberByPosition, {
		position: "Bedriftskontakt",
	});

	return (
		<>
			<ResponsiveCenterContainer>
				<Title>For bedrifter</Title>
				<div className="grid grid-cols-1 gap-6 md:grid-cols-5">
					<div className="grid gap-6 md:col-span-3">
						<ContainerCard className="bg-primary dark:bg-primary">
							<h2 className="scroll-m-10 hyphens-auto pb-2 font-semibold text-3xl text-primary-foreground tracking-tight first:mt-0">
								Navets formål
							</h2>
							<p className="text-primary-foreground leading-7">
								Navets formål er å gjøre det enklere for bedrifter å komme i kontakt med studentene
								ved Institutt for informatikk, UiO. Vi fungerer derfor som instituttets
								koordinerings- og kommunikasjonssentral for bedrifter, ved å blant annet arrangere
								bedriftspresentasjoner og tilby en plattform for stillingsannonser.
							</p>

							<h2 className="scroll-m-20 pb-2 font-semibold text-3xl text-primary-foreground tracking-tight first:mt-0">
								Om instituttet
							</h2>
							<p className="text-primary-foreground leading-7">
								Institutt for Informatikk er det største instituttet ved Universitetet i Oslo målt i
								antall studenter og inneholder mange ulike studieprogrammer og studentforeninger.
								Dette kan gjøre det utfordende å komme i kontakt med riktig studentgrupper. Navet
								knytter bedriftene tettere opp mot studentene med informasjon om instituttet,
								deriblant om de ulike studieretningene og om de mange foreningene.
							</p>
						</ContainerCard>
						<ContainerCard>
							<h2 className="scroll-m-10 hyphens-auto pb-2 font-semibold text-3xl tracking-tight first:mt-0">
								Bedriftspresentasjon, kurs og foredrag
							</h2>
							<p className="leading-7">
								Navet sender i slutten av hvert semester ut en invitasjon der vi oppfordrer
								bedrifter til å søke om og holde bedriftspresentasjon det påfølgende semesteret.
								<br />
								<br />
								Dersom din bedrift ønsker å holde en bedriftspresentasjon ved Institutt for
								informatikk kan dere sende en mail til vår bedriftskontakt og dere vil få mulighet
								ved neste semester gjennom våre maillister.
							</p>
						</ContainerCard>
					</div>
					<div className="grid gap-6 md:col-span-2">
						<LargeUserCard
							title="Bedriftskontakt"
							fullName={
								(companyContact && `${companyContact.firstName} ${companyContact.lastName}`) ??
								"Bedriftskontakt"
							}
							email={companyContact?.positionEmail ?? companyContact?.email ?? "styret@ifinavet.no"}
							imageUrl={companyContact?.image}
							initials="BK"
						/>
						<ContainerCard className="h-fit bg-primary-light">
							<h2 className="scroll-m-10 pb-2 font-semibold text-3xl tracking-tight first:mt-0">
								Stillingsanonnser
							</h2>
							<p className="leading-7">
								Navet tilbyr publisering av stillingsannonser på våre hjemmesider. Dette gjelder
								både interships, deltid-, og fulltidsstillinger. Ved forespørsel om annonser for
								sommerjobb er det viktig at de følger{" "}
								<a
									href="https://drive.google.com/file/d/1wW0356QeoPGtKQruSlP8eBXI7qqn8eHm/view?usp=sharing"
									rel="nofollow noopener noreferrer external"
									target="_blank"
									className="hover:cursor underline"
								>
									FIFs retningslinjer.
								</a>
								<br />
								<br />
								Alle annonser er nødt til å følge{" "}
								<a
									href="https://drive.google.com/file/d/1h4AuNXJ4LFfrrCAdN_anFu7o1F56Q1hx/view"
									rel="nofollow noopener noreferrer external"
									target="_blank"
									className="hover:cursor underline"
								>
									Navet's retningslinjer.
								</a>{" "}
								Stillingsannonser må inneholde en søknadsfrist og stillingen må være relatert til
								informatikk. Nye annonser publiseres ukentlig. Følg linken for å opprette
								stillingsannonse:
							</p>
							<Button
								variant="default"
								size="lg"
								className="bg-primary py-6 text-base text-primary-foreground dark:bg-primary-light dark:text-primary"
								asChild
							>
								<a
									href="https://docs.google.com/forms/d/1pyPhN0eod6g3iwmHLfUycz1CI2KplwZRSbozwrJdaR4/edit"
									target="_blank"
									rel="noopener noreferrer"
								>
									Skjema for stillingsannonser
								</a>
							</Button>
						</ContainerCard>
					</div>
					<ContainerCard className="col-span-full">
						<h2 className="scroll-m-10 pb-2 font-semibold text-3xl tracking-tight first:mt-0">
							Felles informasjon om arrangementer
						</h2>
						<InformationGrid />
					</ContainerCard>
					<div className="col-span-full">
						<OfferGrid />
					</div>
				</div>
			</ResponsiveCenterContainer>
			<JobListingBanner className="mt-8" />
		</>
	);
}
