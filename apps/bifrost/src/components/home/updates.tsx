import { Badge } from "@workspace/ui/components/badge";
import Link from "next/link";
import { humanReadableDate } from "@/utils/utils";

export function Update() {
	return (
		<Link href='/updates'>
			<div className='flex items-center gap-4'>
				<span className='aspect-square size-4 rounded-full bg-primary' />
				<div>
					<div className='flex items-baseline gap-2'>
						<h4 className='font-semibold text-lg'>Christoffer</h4>
						<p className='text-muted-foreground text-sm'>{humanReadableDate(new Date())}</p>
						<Badge>Web</Badge>
					</div>
					<p className='line-clamp-2'>
						Kommer...
					</p>
				</div>
			</div>
		</Link>
	);
}

export default function Updates() {
	return (
		<div className='flex flex-col gap-4'>
			<Update />
		</div>
	);
}
