"use client";

import { DEGREES } from "@workspace/shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { Pie, PieChart } from "recharts";

const chartConfig = {
	antall: {
		label: "Antall",
	},
	bachelor: {
		label: DEGREES.bachelor,
		color: "#2563eb",
	},
	master: {
		label: DEGREES.master,
		color: "var(--chart-2)",
	},
	phd: {
		label: DEGREES.phd,
		color: "var(--chart-3)",
	},
	aarsstudium: {
		label: DEGREES.aarsstudium,
		color: "var(--chart-4)",
	},
	ukjent: {
		label: "Ukjent",
		color: "var(--chart-5)",
	},
} satisfies ChartConfig;

export default function ProgramsChart({
	chartData,
}: Readonly<{
	chartData: {
		degree: string;
		num: number;
		fill: string;
	}[];
}>) {
	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>Antall studenter per grad</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-80 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
				>
					<PieChart>
						<ChartTooltip content={<ChartTooltipContent />} />
						<ChartLegend content={<ChartLegendContent verticalAlign="top" />} />
						<Pie data={chartData} dataKey="num" label nameKey="degree" />
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
