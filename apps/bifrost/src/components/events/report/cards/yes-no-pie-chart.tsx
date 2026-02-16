import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { useMemo } from "react";
import { LabelList, Pie, PieChart } from "recharts";

const chartConfig = {
	sum: {
		label: "Antall",
	},
	yes: {
		label: "Ja",
		color: "var(--chart-2)",
	},
	no: {
		label: "Nei",
		color: "var(--chart-5)",
	},
} satisfies ChartConfig;

function aggregateYesNo(
	data: Record<string, string>[],
	ratingKey: string,
): { answer: string; sum: number; fill: string }[] {
	const counts = { yes: 0, no: 0 };

	for (const entry of data) {
		const value = entry[ratingKey];
		if (value && value === "ja") {
			counts.yes++;
		} else if (value && value === "nei") {
			counts.no++;
		}
	}

	return [
		{ answer: "yes", sum: counts.yes, fill: "var(--color-yes)" },
		{ answer: "no", sum: counts.no, fill: "var(--color-no)" },
	];
}

export default function YesNoPieChart({
	data,
	ratingKey,
	title,
	description,
}: Readonly<{
	data: Record<string, string>[];
	ratingKey: string;
	title: string;
	description: string;
}>) {
	const chartData = useMemo(() => aggregateYesNo(data, ratingKey), [data, ratingKey]);
	console.log("data", chartData);

	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-65 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
				>
					<PieChart>
						<ChartTooltip content={<ChartTooltipContent hideLabel />} />
						<Pie data={chartData} dataKey="sum" nameKey="answer">
							<LabelList
								dataKey="answer"
								className="fill-background"
								stroke="none"
								fontSize={12}
								formatter={(value: keyof typeof chartConfig) => chartConfig[value]?.label}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col gap-2 text-sm">
				<div className="flex items-center gap-2 font-medium leading-none">
					{chartData[0]?.sum ?? 0} ja / {chartData[1]?.sum ?? 0} nei
				</div>
			</CardFooter>
		</Card>
	);
}
