import { cn } from "@workspace/ui/lib/utils";

export default function ContainerCard({
	children,
	className,
}: Readonly<{
	children: React.ReactNode;
	className?: string;
}>) {
	return (
		<div
			className={cn(
				"wrap-break-word flex flex-col gap-4 whitespace-normal text-balance rounded-xl bg-zinc-100 px-10 py-8 md:px-12 dark:bg-zinc-800",
				className,
			)}
		>
			{children}
		</div>
	);
}
