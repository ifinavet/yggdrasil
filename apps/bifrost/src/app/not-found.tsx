import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ArrowLeft, FileQuestion, Home, Mail, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid h-full place-content-center bg-background p-4">
      <div className='w-full max-w-2xl space-y-6'>
        <Card>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted'>
              <FileQuestion className='h-8 w-8 text-muted-foreground' />
            </div>
            <CardTitle className='font-bold text-3xl'>404</CardTitle>
            <CardDescription className='text-xl'>Siden ble ikke funnet</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6 text-center'>
            <p className='text-lg text-muted-foreground'>
              Beklager, siden du leter etter eksisterer ikke eller har blitt flyttet.
            </p>

            <Card className='bg-muted/50 text-left'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-lg'>
                  <Search className='h-5 w-5' />
                  Forslag til hva du kan gjøre
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                <ul className='list-inside list-disc space-y-1 text-sm'>
                  <li>Sjekk at URL-en er skrevet riktig</li>
                  <li>Gå tilbake til forrige side og prøv igjen</li>
                  <li>Besøk forsiden for å finne det du leter etter</li>
                  <li>Bruk søkefunksjonen hvis tilgjengelig</li>
                </ul>
              </CardContent>
            </Card>

            <div className='flex flex-col justify-center gap-3 sm:flex-row'>
              <Button variant='default' asChild className='flex items-center gap-2'>
                <Link href='/'>
                  <Home className='h-4 w-4' />
                  Tilbake til forsiden
                </Link>
              </Button>
              <Button variant='outline' className='flex items-center gap-2'>
                <ArrowLeft className='h-4 w-4' />
                Gå tilbake
              </Button>
            </div>

            <div className='border-t pt-4'>
              <p className='text-muted-foreground text-sm'>
                Kan ikke finne det du leter etter?{" "}
                <a
                  href='mailto:web@ifinavet.no'
                  className='inline-flex items-center gap-1 text-primary hover:underline'
                >
                  <Mail className='h-3 w-3' />
                  Kontakt webansvarlig
                </a>{" "}
                så hjelper vi deg videre.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
