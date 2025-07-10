import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";
import NavetNCircle from "@/assets/navet/navet-n-circle.png";

export default function InformationGrid({ className }: { className?: string }) {
  return (
    <div className={cn(className, "grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16")}>
      <GridEntry>
        Hvert arrangement blir organisert og koordinert av én hovedansvarlig og to medhjelpere fra
        Navet, i samarbeid med en eller flere representanter fra bedriften.
      </GridEntry>
      <GridEntry>
        Alle priser er oppgitt uten merverdiavgift. Utgifter som transport, mat og lignende kommer
        utenom.
      </GridEntry>
      <GridEntry>
        Minimum én dag med stand ved hovedinngangen til IFI. Dere er hjertelig velkomne til å bli
        med oss på standen.
      </GridEntry>
      <GridEntry>
        Det er anbefalt å inkludere noe å drikke og spise på under arrangementet.
        <span className='block text-muted-foreground'>
          Obs! Det er ikke tillatt å servere alkohol på instituttets område, med unntak av
          studentpuben Escape.
        </span>
      </GridEntry>
    </div>
  );
}

function GridEntry({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <Image src={NavetNCircle} alt='Navet Logo' className='aspect-square size-6' />
      <p className='text-balance leading-7'>{children}</p>
    </div>
  );
}
