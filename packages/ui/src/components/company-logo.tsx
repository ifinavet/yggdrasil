import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";

const SIZES = {
	sm: { pixels: 32, className: "size-8 rounded-md text-[10px]" },
	lg: { pixels: 48, className: "size-12 rounded-lg text-[13px]" },
};

export function CompanyLogo({
	name,
	url,
	size = "sm",
}: Readonly<{ name: string; url: string | null; size?: keyof typeof SIZES }>) {
	const { pixels, className } = SIZES[size];

	if (!url) {
		return (
			<span
				className={cn(
					"inline-grid flex-none place-items-center bg-muted font-bold text-muted-foreground",
					className,
				)}
			>
				{name.slice(0, 2)}
			</span>
		);
	}

	return (
		<span
			className={cn("inline-grid flex-none place-items-center overflow-hidden bg-white", className)}
		>
			<Image
				src={url}
				alt={name}
				width={pixels}
				height={pixels}
				className="size-full object-contain p-1"
			/>
		</span>
	);
}
