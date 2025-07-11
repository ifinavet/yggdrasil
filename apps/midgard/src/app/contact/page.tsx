import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import TwoColumns from "@/components/common/two-columns";
import { getBoardMemberByPosition } from "@/lib/query/organization";

export const metadata = {
  title: "Si ifra",
};

export default async function ContactPage() {
  const { user } = await getBoardMemberByPosition("Studentkontakt");

  return (
    <ResponsiveCenterContainer>
      <TwoColumns
        main={
          <ContainerCard>
            <div className='flex flex-col gap-4'>
              <h2 className='scroll-m-10 pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
                Opplevd noe ugreit?
              </h2>
              <p className='leading-7'>
                Dersom du har opplevd ubehagelige hendelser eller situasjoner under et av Navets
                arrangementer, oppfordrer vi deg sterkt til å si ifra. Det er viktig for oss å vite,
                uansett om det involverer en bedriftsrepresentant, en annen student, eller et medlem
                av Navet. Om ønskelig vil all informasjon du deler bli behandlet med full
                konfidensialitet.
              </p>
              <p className='leading-7'>
                Du kan alltid kontakte vår studentkontakt, nestleder eller et annet styremedlem
                dersom du trenger å diskutere en sak eller ønsker veiledning.
              </p>
              <p className='leading-7'>
                Vær trygg på at alle innmeldte saker vil bli tatt på alvor. Om det kommer inn
                rapporter som krever en upartisk behandling, vil vi vurdere å bringe saken videre
                til studieadministrasjonen eller andre relevante parter for en objektiv vurdering.
              </p>
              <p className='leading-7'>
                <strong>Skjema</strong>:{" "}
                <a
                  href='https://nettskjema.no/a/528318#/page/1'
                  rel='noopener'
                  target='_blank'
                  title='Skjema'
                  className='text-primary underline'
                >
                  https://nettskjema.no/a/528318#/page/1
                </a>
              </p>
            </div>
          </ContainerCard>
        }
        aside={
          <LargeUserCard
            title='Studentkontakt'
            fullName={user.fullName ?? "ukjent"}
            email={user.primaryEmailAddress?.emailAddress ?? "styret@ifinavet.no"}
            imageUrl={user.imageUrl ?? ""}
          />
        }
      />
    </ResponsiveCenterContainer>
  );
}
