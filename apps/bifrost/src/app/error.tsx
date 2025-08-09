"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { AlertTriangle, Bug, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    posthog.captureException(error, { site: "bifrost" });
  }, [error]);

  return (
    <div className="grid h-full place-content-center bg-background p-4">
      <div className='w-full max-w-2xl space-y-6'>
        <Card>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10'>
              <AlertTriangle className='h-8 w-8 text-destructive' />
            </div>
            <CardTitle className='font-bold text-3xl'>500</CardTitle>
            <CardDescription className='text-xl'>Intern serverfeil</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6 text-center'>
            <p className='text-lg text-muted-foreground'>
              Beklager, det oppstod en uventet feil. Vi jobber med å løse problemet.
            </p>

            <Card className='bg-muted/50 text-left'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-lg'>
                  <Bug className='h-5 w-5' />
                  Utviklingsinformasjon
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div>
                  <p className='font-semibold text-sm'>Feilmelding:</p>
                  <p className='rounded border bg-background p-2 font-mono text-sm'>
                    {error.message || "Ukjent feil"}
                  </p>
                </div>
                {error.stack && (
                  <div>
                    <p className='font-semibold text-sm'>Stack trace:</p>
                    <pre className='max-h-40 overflow-auto rounded border bg-background p-2 font-mono text-xs'>
                      {error.stack}
                    </pre>
                  </div>
                )}
                {error.digest && (
                  <div>
                    <p className='font-semibold text-sm'>Feil-ID:</p>
                    <p className='rounded border bg-background p-2 font-mono text-sm'>
                      {error.digest}
                    </p>
                  </div>
                )}
                <div>
                  <p className='font-semibold text-sm'>Feiltype:</p>
                  <p className='text-sm'>{error.name || "Error"}</p>
                </div>
              </CardContent>
            </Card>

            <div className='flex flex-col justify-center gap-3 sm:flex-row'>
              <Button variant='default' onClick={reset} className='flex items-center gap-2'>
                <RefreshCw className='h-4 w-4' />
                Prøv igjen
              </Button>
              <Button variant='outline' asChild className='flex items-center gap-2'>
                <Link href='/'>
                  <Home className='h-4 w-4' />
                  Tilbake til forsiden
                </Link>
              </Button>
            </div>

            <div className='border-t pt-4'>
              <p className='text-muted-foreground text-sm'>
                Hvis problemet vedvarer, vennligst{" "}
                <a href='mailto:web@ifinavet.no' className='text-primary hover:underline'>
                  kontakt webansvarlig
                </a>
                {error.digest && (
                  <>
                    {" "}
                    og oppgi feil-ID:{" "}
                    <code className='rounded bg-muted px-1 py-0.5 text-xs'>{error.digest}</code>
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
