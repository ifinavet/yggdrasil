import { cn } from "@workspace/ui/lib/utils";

const SPARK_HEIGHT = 22;
const EMPTY_HEIGHT = 2;

export type SparkValue = { label: string; value: number; title: string };

export function Sparkline({
	values,
	max,
}: Readonly<{ values: readonly SparkValue[]; max: number }>) {
	return (
		<span className="inline-flex h-[22px] items-end gap-[3px]">
			{values.map(({ label, value, title }) => (
				<span
					key={label}
					title={title}
					className={cn("w-2 rounded-[1px]", value > 0 ? "bg-primary" : "bg-border")}
					style={{ height: Math.max(EMPTY_HEIGHT, max > 0 ? (value / max) * SPARK_HEIGHT : 0) }}
				/>
			))}
		</span>
	);
}
