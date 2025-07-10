import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import TwoColumns from "@/components/common/two-columns";
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
                send en mail til {" "}
                <a href='mailto:koordinator@ifinavet.no' className="text-primary underline">koordinator@ifinavet.no</a>!
                <br />
                <br />
                Dersom du opplever problemer med nettsiden send mail til {" "}
                <a href='mailto:web@ifinavet.no' className="text-primary underline">web@ifinavet.no</a>
                <br />
                <br />
                Ønsker du å bli intern i Navet?
                <br />
                <br />
                Vi tar opp nye interne ved semesterstart🤩!
              </p>
            </ContainerCard>
            <FAQCard />
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
                Brukeren registreres med ditt UiO brukernavn eller epost. Ved førstegangs registrering vil du få passord på
                mail.
                <br />
                Når du har opprettet en ny bruker kan du selv redigere og legge til
                informasjon på din brukerprofil.
              </p>
            </ContainerCard>
          </div>
        }
      />
    </ResponsiveCenterContainer>
  );
}

export function FAQCard() {
  return (
    <ContainerCard>
      <div>
        <h2 className="mb-6 scroll-m-20 pb-2 font-semibold text-3xl tracking-tight first:mt-0">
          Ofte stilte spørsmål
        </h2>
        <div className='grid gap-4'>
          <div>
            <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>Hva er navet?</h3>
            <p className='leading-7 [&:not(:first-child)]:mt-6'>
              Navet er bedriftskontakten ved Institutt for informatikk, og formålet vårt er å knytte
              deg som IFI-student opp mot arbeidsmarkedet. Dette gjør vi ved å arrangere
              bedriftsarrangementer (nesten) hver tirsdag og torsdag gjennom hele skoleåret. I
              tillegg publiserer vi stillingsannonser for både deltid-, fulltid- og sommerjobber her
              på nettsiden.
            </p>
          </div>
          <div>
            <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
              Hva er en "bedpres"?
            </h3>
            <p className='leading-7 [&:not(:first-child)]:mt-6'>
              Bedpres er en forkortelse av ordet bedriftspresentasjon, som er arrangementene vi
              holder i samarbeid med bedrifter. På bedpres får man typisk mulighet til å bli bedre
              kjent med en bedrift, enten gjennom en presentasjon, et kurs, en konkurranse eller
              lignende. Det er heller ikke uvanlig at man blir påspandert middag og noe godt å
              drikke!
            </p>
          </div>
          <div>
            <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
              Hvordan melder jeg meg på bedpresser?
            </h3>
            <p className='leading-7 [&:not(:first-child)]:mt-6'>
              For å melde deg på må du opprette en bruker her på nettsiden. Når du er logget inn kan
              du melde deg på arrangementer som har åpnet påmeldingen og fortsatt har ledige
              plasser.
            </p>
          </div>
          <div>
            <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
              Hvordan kan jeg bli intern i Navet?
            </h3>
            <p className='leading-7 [&:not(:first-child)]:mt-6'>
              Vi er alltid på utkikk etter nye studenter som vil bidra til å gjøre Navet enda bedre!
              Hovedsakelig rekrutterer vi i starten av hvert semester (august og januar), men du kan
              alltids kontakte oss når som helst for å fortelle litt om deg selv og hva du ønsker å
              bidra med!
            </p>
          </div>
          <div>
            <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
              Jeg har opplevd noe ugreit i Navet, hva gjør jeg?
            </h3>
            <p className='leading-7 [&:not(:first-child)]:mt-6'>
              Om du har opplevd noe ugreit i et av Navets arrangement håper vi du vil fortelle oss
              om dette. Vi vil gjerne vite om det enten det er en bedrift, student eller et
              styremedlem som har vært ugrei. Ved ønske vil dine opplysninger behandles anonymt. Du
              kan når som helst kontakte nestleder, koordinator eller et annet styremedlem ved
              behov.
            </p>
          </div>
        </div>
      </div>
    </ContainerCard>
  );
}
