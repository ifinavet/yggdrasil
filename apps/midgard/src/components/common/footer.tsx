import { Button } from "@workspace/ui/components/button";
import ThemeSwitcher from "@workspace/ui/components/theme-switcher";
import Link from "next/link";

export default function Footer() {
	return (
		<footer className="z-20 flex w-full justify-center bg-primary py-10 text-primary-foreground dark:bg-zinc-800">
			<div className="flex h-fit w-full max-w-6xl flex-wrap justify-between gap-8 px-8">
				<div className="flex flex-col gap-2 px-4 sm:px-0">
					<div className="font-semibold text-lg">IFI-Navet</div>
					<p className="leading-none">Postboks 1080 Blindern </p>
					<p className="leading-none">Institutt for informatikk</p>
					<p className="leading-none">0316 Oslo, Norway</p>
				</div>
				<div className="flex flex-col items-start gap-4 sm:items-end">
					<Button
						type="button"
						variant="link"
						className="text-base text-primary-foreground"
						asChild
					>
						<Link href="/info/personvernerklaering">Personvernerklæring</Link>
					</Button>
					<Button
						type="button"
						variant="link"
						className="text-base text-primary-foreground"
						asChild
					>
						<Link href="/info/retningslinjer">Retningslinjer</Link>
					</Button>
					<ThemeSwitcher />
				</div>
			</div>
		</footer>
	);
}
