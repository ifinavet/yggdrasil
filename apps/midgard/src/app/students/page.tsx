import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import TwoColumns from "@/components/common/two-columns";
import FAQGrid from "@/components/students/faq-grid";
import { getBoardMemberByPosition } from "@/lib/query/organization";

export default async function StudentsPage() {
	const { user } = await getBoardMemberByPosition("Koordinator");

	return (
		<ResponsiveCenterContainer>
			<Title>For studenter</Title>
			<TwoColumns
				main={
					<div className='grid gap-6'>
						<ContainerCard>
							<h2 className='scroll-m-20 pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
								Hei IFI-Student! 👋
							</h2>
							<p className='leading-7 [&:not(:first-child)]:mt-6'>
								Her har vi forsøkt å samle de mest vanlige spørsmålene om Navet. Hvis du har et
								spørsmål du ikke finner svar på her, kontakt oss gjerne på våre SoMe-kanaler eller
								send en mail til{" "}
								<a href='mailto:koordinator@ifinavet.no' className='text-primary underline'>
									koordinator@ifinavet.no
								</a>
								!
								<br />
								<br />
								Dersom du opplever problemer med nettsiden send mail til{" "}
								<a href='mailto:web@ifinavet.no' className='text-primary underline'>
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
					<div className='grid gap-6'>
						<LargeUserCard
							title='Koordinator'
							fullName={user.fullName ?? "Ukjent"}
							email={user.primaryEmailAddress?.emailAddress ?? "Ukjent"}
							imageUrl={user.imageUrl}
						/>
						<ContainerCard>
							<h3 className='scroll-m-20 text-center font-semibold text-4xl text-primary tracking-tight'>
								Ny student?
							</h3>
							<p className='leading-7 [&:not(:first-child)]:mt-6'>
								For deg som ny student er det bare å opprette en ny bruker.
								<br />
								Brukeren registreres med ditt UiO brukernavn eller epost. Ved førstegangs
								registrering vil du få passord på mail.
								<br />
								Når du har opprettet en ny bruker kan du selv redigere og legge til informasjon på
								din brukerprofil.
							</p>
						</ContainerCard>
					</div>
				}
			/>
		</ResponsiveCenterContainer>
	);
}
