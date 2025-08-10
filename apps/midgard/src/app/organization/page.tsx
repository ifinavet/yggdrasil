import { api } from "@workspace/backend/convex/api";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
import NavetN from "@/assets/navet/logo_n_blaa.webp";
import Navet from "@/assets/promo_images/navet.webp";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import TwoColumns from "@/components/common/two-columns";

export default async function OrganizationPage() {
  const theBoard = await fetchQuery(api.internals.getTheBoard);

  return (
    <ResponsiveCenterContainer className='!max-w-6xl'>
      <Title>Foreningen IFI-Navet</Title>
      <div className='flex flex-col gap-6'>
        <TwoColumns
          main={
            <div>
              <h3 className='scroll-m-20 font-semibold text-4xl text-primary tracking-tight'>
                Hvem er vi?
              </h3>
              <p className='leading-7 [&:not(:first-child)]:mt-6'>
                Navet er bedriftskontakten ved Institutt for informatikk ved Universitetet i Oslo.
                Hensikten med Navet er å gjøre det enkelt for bedrifter å komme i kontakt med
                studentene ved instituttet, ved å tilby:
              </p>

              <ul className='my-6 ml-6 list-disc [&>li]:mt-2'>
                <li>
                  et sentralt kontakt- og koordineringspunkt for alle bedriftsrelaterte aktiviteter
                  ved instituttet.
                </li>
                <li>
                  praktisk hjelp ved bedriftspresentasjoner og andre typer arrangementer
                  (romreservasjon, matbestilling, mm.)
                </li>
                <li>oversikt over bredriftsrelaterte aktiviteter for studenter.</li>
              </ul>

              <p>
                Følg oss på våre sosiale medier for å holde deg oppdatert på hva som skjer i Navet:
              </p>
              <ul className="my-6 ml-6 grid w-fit list-disc gap-2 md:grid-cols-2 [&>li]:mt-2 [&>li]:pr-8">
                <li>
                  <a
                    href='https://www.instagram.com/ifinavet/'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary underline'
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href='https://www.facebook.com/share/1C1q1rEvmL/?mibextid=wwXIfr'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary underline'
                  >
                    Facebook
                  </a>
                </li>
                <li>
                  <a
                    href='https://ie.linkedin.com/company/ifinavet'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary underline'
                  >
                    Linkedin
                  </a>
                </li>
                <li>
                  <a
                    href='https://github.com/ifinavet'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary underline'
                  >
                    Github
                  </a>
                </li>
              </ul>
            </div>
          }
          aside={<Image src={Navet} alt='Navet Logo' className='h-full rounded-lg object-cover' />}
        />
        <FlowyLine className='w-full stroke-[8] text-primary' curveHeight={-300} />
        <div aria-description='Livet som intern'>
          <h3 className='scroll-m-20 font-semibold text-4xl text-primary tracking-tight'>
            Livet som intern
          </h3>
          <div className='flex h-fit flex-wrap items-start gap-8'>
            <p className='mb-4 max-w-[80ch] leading-7 [&:not(:first-child)]:mt-6'>
              Som intern i Navet er du en viktig del av driften i foreningen. Gjennom et semester
              vil du som regel være ansvarlig eller medansvarlig for 2–3 bedriftspresentasjoner. I
              tillegg bidrar interne til styrets arbeid gjennom å være med i en av arbeidsgruppene.
              Mer informasjon om arbeidsgruppene finner du under. En gang i måneden har vi
              internmøte, der hele foreningen samles for oppdateringer om aktuelle saker. Det er
              viktig å være engasjert og hjelpe til ved behov. Det er viktig å huske at det ikke
              bare er arbeid, men mye sosialt også! Etter hvert internmøte er det internkveld, som
              er sponset av foreningen. Foreningen har mye sosialt å by på, som utenlandstur,
              julebord, sommerfest og mange andre små og store aktiviteter gjennom året.
            </p>
            <div className='grid h-full flex-1 place-content-center'>
              <Image src={NavetN} alt='N logo' className='h-32 w-auto rotate-12 object-contain' />
            </div>
          </div>
          <div className='grid justify-center gap-12 sm:grid-cols-2 lg:grid-cols-3'>
            <InternGroup name='Interngruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                I interngruppen så organiserer vi alle Navets interne arrangementer. Vi planlegger
                internkveldene og de større avsluttningene på slutten av hvert semester. Vi jobber
                på for at alle i Navet skal ha det så bra som mulig (og gøy som mulig).
              </p>
            </InternGroup>
            <InternGroup name='Bedriftsgruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Vi i bedriftsgruppen gjør kanskje Navets viktigste jobb, vi finner bedriftene som
                skal ha bedriftspresentasjoner. Bedriftsgruppen jobber kontinuerlig med å finne
                bedrifter for studentene. Uten oss så får vi ingen bedrifter som kan lære og
                informere studente om arbeidslivet.
              </p>
            </InternGroup>
            <InternGroup name='Organiseringsgruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Organiseringsteamet har ansvar for å sikre den praktiske gjennomføringen av Navets
                arrangementer. Vi tar oss av booking av rom, bestilling av mat og sørger for at alt
                er på plass før arrangementet starter. Vi gjør vårt beste for at alt det praktiske
                går sømløst.
              </p>
            </InternGroup>
            <InternGroup name='Økonomigruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                I økonomigruppen får du innsikt i hvordan Navets økonomi drives. Som intern bidrar
                du til både regnskapsføring og budsjettering for en større forening.
              </p>
            </InternGroup>
            <InternGroup name='Promoteringsgruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Som del av promoteringsgruppen vil du hjelpe promoteringsansvarlig med synligheten
                og kommunikasjonen til Navet, slik at vi kan nå ut til studenter og bedrifter. Vi
                har ansvar for å formidle hva Navet driver med, skape engasjement rundt
                arrangementene våre og bygge et positivt inntrykk av foreningen.
              </p>
            </InternGroup>
            <InternGroup name='Webteamet'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Arrangementsgruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                I arrangementsgruppen så passer vi på at alle navets arrangementer går på skinner.
                Vi har ansvaret for prikke systemet og assisterer de andre gruppene i sine oppgaver,
                og samhandler med andre foreninger ved større arrangementer.
              </p>
            </InternGroup>
            <InternGroup name='Koordineringsgruppen'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp koordinator i sine oppgaver. Vi gjør et variert utvalg med oppgaver, men
                kjernen er stillingsannonser. Vi legger ut og passer på at alt er i orden med
                stillingsannonsene.
              </p>
            </InternGroup>
          </div>
        </div>
        <FlowyLine className='w-full stroke-[8] text-primary' curveHeight={250} />
        <div aria-description='Styret'>
          <h3 className='mb-4 scroll-m-20 font-semibold text-4xl text-primary tracking-tight'>
            Styret
          </h3>
          <div className='flex flex-wrap justify-center gap-4'>
            {theBoard.map((member) => (
              <BoardMember
                key={member._id}
                className='min-w-48 basis-[calc(25%-0.75rem)]'
                position={member.position}
                name={member.fullName}
                email={member.positionEmail ?? member.email}
                image={member.image}
              />
            ))}
          </div>
        </div>
      </div>
    </ResponsiveCenterContainer>
  );
}

function FlowyLine({
  className = "text-sky-500 stroke-[6]",
  curveHeight = 160, // wave height
  baseHeight = 160, // vertical center
}: {
  className?: string;
  curveHeight?: number;
  baseHeight?: number;
}) {
  const pathData = `M0,${baseHeight} C360,${baseHeight + curveHeight} 1080,${baseHeight - curveHeight
    } 1440,${baseHeight}`;

  return (
    <div className='flex h-32 w-full items-center justify-center'>
      <svg
        className={`h-full w-full ${className}`}
        viewBox='0 0 1440 320'
        preserveAspectRatio='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <title>Flowy Line</title>
        <path fill='none' stroke='currentColor' d={pathData} />
      </svg>
    </div>
  );
}

function InternGroup({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-48 flex-col", className)}>
      <h4 className='scroll-m-20 border-primary border-b-2 font-semibold text-2xl text-primary tracking-tight'>
        {name}
      </h4>
      {children}
    </div>
  );
}

function BoardMember({
  position,
  name,
  email,
  image,
  className,
}: {
  position: string;
  name: string;
  email: string;
  image?: string;
  className?: string;
}) {
  return (
    <div className={cn(className, "flex flex-col items-center gap-2")}>
      <Avatar className='size-28'>
        <AvatarImage src={image} />
        <AvatarFallback>{position.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <h2 className='font-semibold text-2xl text-primary'>{position}</h2>
      <Separator className='rounded-lg border-1 border-primary' />
      <div className='flex flex-col items-center'>
        <h3 className='text-pretty text-center font-semibold text-lg'>{name}</h3>
        <Button variant='link'>
          <a href={`mailto:${email}`} className='text-balance text-center'>
            {email}
          </a>
        </Button>
      </div>
    </div>
  );
}
