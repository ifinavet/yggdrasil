import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
import SafeHtml from "../common/sanitize-html";

export default async function MainSponsorCard() {
	const mainSponsor = await fetchQuery(api.companies.getMainSponsor);

	return (
		<div className='xl:-ml-24 order-2 max-w-xl space-y-6 md:order-1'>
			<h1 className='hyphens-manual text-balance font-bold text-4xl text-primary tracking-tight'>
				Hoved&shy;samarbeids&shy;partner
			</h1>
			<div className='flex flex-col items-center gap-6 rounded-xl bg-primary-light px-4 py-16 md:px-8 lg:flex-row'>
				<div className='grid aspect-square size-32 place-content-center rounded-full border-2 border-neutral-300 bg-white'>
					{mainSponsor?.imageUrl && (
						<Image
							src={mainSponsor.imageUrl}
							alt={mainSponsor.name}
							width={200}
							height={200}
							className='h-auto p-8'
							loading='eager'
						/>
					)}
				</div>
				<div className='flex h-full flex-col justify-start gap-2'>
					<h1 className='font-bold text-4xl text-primary'>{mainSponsor?.name}</h1>
					<SafeHtml html={mainSponsor?.description || ""} className='prose text-primary' />
				</div>
			</div>
		</div>
	);
}
