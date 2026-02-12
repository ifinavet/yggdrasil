"use client";

import {
	Card,
	CardContent,
	CardDescription,
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
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

const chartConfig = {
	place: {
		label: "",
		color: "var(--chart-2)",
	},
	number: {
		label: "antall",
		color: "var(--chart-2)",
	},
	label: {
		color: "var(--background)",
	},
} satisfies ChartConfig;

function answerdAggregate(data: Record<string, string[]>[], key: string) {
	const counts = new Map<string, number>();

	for (const entry of data) {
		const values = entry[key];
		if (!Array.isArray(values)) continue;

		for (const value of values) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}

	return Array.from(counts, ([place, number]) => ({ place, number })).sort(
		(a, b) => b.number - a.number,
	);
}

export function HorizontalMultipleChoiseAggregateBarChartCard({
	data,
	ratingKey,
	title,
	description,
}: Readonly<{
	data: Record<string, string[]>[];
	ratingKey: string;
	title: string;
	description: string;
}>) {
	const chartData = useMemo(() => answerdAggregate(data, ratingKey), [data, ratingKey]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart
						accessibilityLayer
						data={chartData}
						layout="vertical"
						margin={{
							right: 16,
						}}
					>
						<CartesianGrid horizontal={false} />
						<YAxis
							dataKey="place"
							type="category"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							hide
						/>
						<XAxis dataKey="number" type="number" hide />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
						<Bar dataKey="number" layout="vertical" fill="var(--color-number)" radius={4}>
							<LabelList
								dataKey="place"
								position="insideLeft"
								offset={8}
								className="fill-(--color-label)"
								fontSize={12}
							/>
							<LabelList
								dataKey="number"
								position="right"
								offset={8}
								className="fill-foreground"
								fontSize={12}
							/>
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
