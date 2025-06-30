import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full flex justify-center bg-primary text-primary-foreground py-8">
      <div className="px-4 gap-4 w-full max-w-sm md:max-w-md lg:max-w-xl xl:max-w-6xl grid grid-cols-1 sm:grid-cols-2 justify-between">
        <div className="px-4 sm:px-0 flex flex-col gap-2">
          <div className="text-lg font-semibold">IFI-Navet</div>
          <p className="leading-none">Postboks 1080 Blindern </p>
          <p className="leading-none">Institutt for informatikk</p>
          <p className="leading-none">0316 Oslo, Norway</p>
        </div>
        <div className="flex flex-col gap-4 items-start sm:items-end">
          <Button type="button" variant="link" className="text-primary-foreground text-base" asChild>
            <Link href="/info">Personvernerklæring</Link>
          </Button>
          <Button type="button" variant="link" className="text-primary-foreground text-base" asChild>
            <Link href="/info">Rettningslinjer</Link>
          </Button>
        </div>
      </div>
    </footer>
  );
}
