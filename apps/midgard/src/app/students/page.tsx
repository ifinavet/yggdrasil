import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import TwoColumns from "@/components/common/two-columns";
import FAQGrid from "@/components/students/faq-grid";

export const metadata: Metadata = {
	title: "For studenter",
};

export default async function StudentsPage() {
	"use cache";
	cacheLife("max");

	const coordinator = await fetchQuery(api.users.organization.queries.getBoardMemberByPosition, {
		position: "Koordinator",
	});

	return (
		<ResponsiveCenterContainer>
			<Title>For studenter</Title>
			<TwoColumns
				main={
					<div className="grid gap-6">
						<ContainerCard className="bg-primary text-primary-foreground dark:bg-primary">
							<h2 className="scroll-m-20 pb-2 font-semibold text-3xl tracking-tight first:mt-0">
								Hei IFI-Student! 👋
							</h2>
							<p className="not-first:mt-6 leading-7">
								Her har vi forsøkt å samle de mest vanlige spørsmålene om Navet.
								Hvis du har et spørsmål du ikke finner svar på her, kontakt oss
								gjerne på våre SoMe-kanaler eller send en mail til{" "}
								<a href="mailto:koordinator@ifinavet.no" className="underline">
									koordinator@ifinavet.no
								</a>
								!
								<br />
								<br />
								Dersom du opplever problemer med nettsiden send mail til{" "}
								<a href="mailto:web@ifinavet.no" className="underline">
									web@ifinavet.no
								</a>
								<br />
								<br />
								Ønsker du å bli intern i Navet?
								<br />
								<br />
								Vi tar opp nye interne ved semesterstart🤩!
							</p>
						</ContainerCard>
						<FAQGrid />
					</div>
				}
				aside={
					<div className="grid gap-6">
						<LargeUserCard
							title="Koordinator"
							fullName={
								(coordinator &&
									`${coordinator.firstName} ${coordinator.lastName}`) ??
								"Koordinator"
							}
							email={
								coordinator?.positionEmail ??
								coordinator?.email ??
								"styret@ifinavet.no"
							}
							imageUrl={coordinator?.image}
							initials="KO"
						/>
						<ContainerCard className="bg-primary-light">
							<h3 className="scroll-m-20 text-center font-semibold text-4xl text-primary tracking-tight dark:text-primary-foreground">
								Ny student?
							</h3>
							<p className="not-first:mt-6 leading-7">
								For deg som ny student er det bare å opprette en ny bruker.
								<br />
								Brukeren registreres med ditt UiO brukernavn eller epost. Ved
								førstegangs registrering vil du få passord på mail.
								<br />
								Når du har opprettet en ny bruker kan du selv redigere og legge
								til informasjon på din brukerprofil.
							</p>
						</ContainerCard>
					</div>
				}
			/>
		</ResponsiveCenterContainer>
	);
}
