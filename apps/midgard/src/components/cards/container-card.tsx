import { cn } from "@workspace/ui/lib/utils";

export default function ContainerCard({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 whitespace-normal text-balance break-words rounded-xl bg-zinc-100 px-10 py-8 md:px-12",
				className,
			)}
		>
			{children}
		</div>
	);
}
