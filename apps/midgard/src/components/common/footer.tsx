import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function Footer() {
	return (
		<footer className='flex w-full justify-center bg-primary py-8 text-primary-foreground'>
			<div className='grid w-full max-w-sm grid-cols-1 justify-between gap-4 px-4 sm:grid-cols-2 md:max-w-md lg:max-w-xl xl:max-w-6xl'>
				<div className='flex flex-col gap-2 px-4 sm:px-0'>
					<div className='font-semibold text-lg'>IFI-Navet</div>
					<p className='leading-none'>Postboks 1080 Blindern </p>
					<p className='leading-none'>Institutt for informatikk</p>
					<p className='leading-none'>0316 Oslo, Norway</p>
				</div>
				<div className='flex flex-col items-start gap-4 sm:items-end'>
					<Button
						type='button'
						variant='link'
						className='text-base text-primary-foreground'
						asChild
					>
						<Link href='/info'>Personvernerklæring</Link>
					</Button>
					<Button
						type='button'
						variant='link'
						className='text-base text-primary-foreground'
						asChild
					>
						<Link href='/info'>Rettningslinjer</Link>
					</Button>
				</div>
			</div>
		</footer>
	);
}
