import { api } from "@workspace/backend/convex/api";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
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
              <ul className='my-6 ml-6 list-disc [&>li]:mt-2'>
                <li>
                  <a
                    href='https://www.instagram.com/ifinavet/'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary hover:underline'
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href='https://ie.linkedin.com/company/ifinavet'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary hover:underline'
                  >
                    Linkedin
                  </a>
                </li>
                <li>
                  <a
                    href='https://github.com/ifinavet'
                    rel='nofollow noopener noreferrer external'
                    target='_blank'
                    className='text-primary hover:underline'
                  >
                    Github
                  </a>
                </li>
              </ul>
            </div>
          }
          aside={
            <div>
              <Image src={Navet} alt='Navet Logo' className='rounded-lg' />
            </div>
          }
        />
        <FlowyLine className='w-full stroke-[8] text-primary' curveHeight={-300} />
        <div aria-description='Livet som intern'>
          <h3 className='scroll-m-20 font-semibold text-4xl text-primary tracking-tight'>
            Livet som intern
          </h3>
          <p className='mb-4 leading-7 [&:not(:first-child)]:mt-6'>
            Lorem ipsum dolor, sit amet consectetur adipisicing elit. Laboriosam voluptate numquam
            ullam nam sint non saepe iste hic reiciendis. Mollitia totam in beatae. Corrupti
            accusamus alias harum laborum, unde similique mollitia doloribus fugit a laboriosam
            repellat eos sunt asperiores ullam? Totam eos incidunt consequatur cupiditate velit
            optio ducimus itaque repudiandae!
          </p>
          <div className='grid justify-center gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            <InternGroup name='Interngruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Bedriftsgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Organiseringsgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Økonomigruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Promoteringsgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Webgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Arrangementsgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
              </p>
            </InternGroup>
            <InternGroup name='Koordineringsgruppa'>
              <p className='leading-7 [&:not(:first-child)]:mt-4'>
                Hjelp webasnvarlig med å vedlikeholde, teste, og utvikle nye funksjoner for Navets
                webplatform. Dette er en unik mulighet til å jobbe med et større system som brukes
                av mange ifi-studenter daglig.
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
  className = "text-sky-500 stroke-[6]", // Tailwind color + thickness
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
    <div className="flex h-32 w-full items-center justify-center">
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
        <h3 className='font-semibold text-lg'>{name}</h3>
        <Button variant='link'>
          <a href={`mailto:${email}`}>{email}</a>
        </Button>
      </div>
    </div>
  );
}
