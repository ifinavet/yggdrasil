"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

function aggregateRatings(
	data: Record<string, number>[],
	ratingKey: string,
): { rating: number; sum: number }[] {
	const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

	for (const entry of data) {
		const value = entry[ratingKey];
		if (value != null && value >= 1 && value <= 5) {
			counts[Math.round(value)] = (counts[Math.round(value)] ?? 0) + 1;
		}
	}

	return [1, 2, 3, 4, 5].map((rating) => ({
		rating,
		sum: counts[rating] ?? 0,
	}));
}

export default function RatingBarChartCard({
	data,
	ratingKey,
	color = "--chart-1",
	title,
	description,
}: Readonly<{
	data: Record<string, number>[];
	ratingKey: string;
	color: string;
	title: string;
	description: string;
}>) {
	const chartData = useMemo(() => aggregateRatings(data, ratingKey), [data, ratingKey]);
	const yMax = useMemo(() => Math.max(...chartData.map((d) => d.sum)) + 1, [chartData]);

	const chartConfig = {
		sum: {
			label: "Antall",
			color: `var(${color})`,
		},
	};

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
						margin={{
							top: 20,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis dataKey={"rating"} tickLine={false} tickMargin={10} axisLine={false} />
						<YAxis
							domain={[0, yMax]}
							allowDecimals={false}
							tickLine={false}
							axisLine={false}
							width={15}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
						<Bar dataKey="sum" fill="var(--color-sum)" radius={8}>
							<LabelList position="top" offset={12} className="fill-foreground" fontSize={12} />
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
