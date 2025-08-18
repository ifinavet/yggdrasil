import { Button } from "@workspace/ui/components/button";

export default function LargeUserCard({
	initials = "NA",
	imageUrl,
	fullName,
	email,
	title,
}: {
	initials?: string;
	imageUrl?: string;
	fullName: string;
	email: string;
	title: string;
}) {
	return (
		<div>
			<div className='relative aspect-square max-h-36 w-full'>
				<div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
				<div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
				<div className='absolute inset-0 grid place-content-center rounded-full bg-transparent'>
					{(imageUrl && (
						<img src={imageUrl} alt={fullName} className='h-36 w-36 rounded-full object-cover' />
					)) ?? (
						<div className='grid h-36 w-36 place-content-center rounded-full bg-gradient-to-br from-primary via-sky-800 to-emerald-800 font-bold text-5xl text-primary-foreground'>
							<span className='m-0 leading-0 '>{initials}</span>
						</div>
					)}
				</div>
			</div>
			<div className='rounded-b-xl bg-zinc-100 px-8 pt-2 pb-8'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-full text-center'>
						<p className='font-semibold text-lg'>{title}</p>
						<p>{fullName}</p>
					</div>
					<Button asChild className='w-1/2'>
						<a href={`mailto:${email}`}>Ta kontakt</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
