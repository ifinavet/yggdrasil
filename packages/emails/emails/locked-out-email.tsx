import {
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  pixelBasedPreset,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export default function LockedOutEmail() {
  return (
    <Html lang='no'>
      <Head>
        <Font fontFamily='Helvetica' fallbackFontFamily='sans-serif' />
      </Head>

      <Preview>
        Du har fått for mange prikker.
      </Preview>

      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                primary: "#2f3e5f",
              },
            },
          },
        }}
      >
        <Container className='mx-auto my-auto w-full max-w-[600px] px-4 py-8'>
          <Img
            src='https://gallant-pheasant-518.convex.cloud/api/storage/6aa758e2-ee53-449a-af69-9534518f3d6c'
            alt='Navet Logo'
            height='50px'
            className='pb-4'
          />

          <Heading as='h1' className='text-primary'>
            Du har fått for mange prikker
          </Heading>

          <Text className='text-lg'>
            Ettersom at du har fått for mange prikker,
            så vil du ikke ha mulighet til å melde deg på nye bedriftspresentasjoner.
          </Text>

          <Text className='pt-4'>
            Hver prikk varer i 6 måneder, og du kan melde deg på nye bedriftspresentasjoner når du har færre enn 3 prikker.
          </Text>

          <Section>
            <Text className='text-gray-800'>
              Du kan se dine prikkene på{" "}
              <a href='https://ifinavet.no/profile' className='text-primary underline'>
                din side
              </a>
              .
            </Text>
          </Section>

          <Hr />

          <Text className='py-4 text-gray-700 text-sm'>
            Dersom du mener at dette er en feil kan du svare på eposten, eller sende en epost til{" "}
            <a href='mailto:arrangement@ifinavet.no'>arrangement@finavet.no</a>
          </Text>

          <Text className='pt-16 text-center text-gray-400 text-lg leading-[18px]'>
            © {new Date().getFullYear()} IFI-Navet
          </Text>
        </Container>
      </Tailwind>
    </Html>
  );
}
