"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
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
	Informatikk__programmering_og_systemarkitektur: {
		label: "Prosa",
		color: "var(--chart-1)",
	},
	Informatikk__design__bruk_og_interaksjon: {
		label: "Design",
		color: "var(--chart-2)",
	},
	Informatikk__digital_økonomi_og_ledelse: {
		label: "Digøk",
		color: "var(--chart-3)",
	},
	Informatikk__språkteknologi: {
		label: "Språktek",
		color: "var(--chart-4)",
	},
	Informatikk__maskinlæring_og_kunstig_intelligens: {
		label: "Maki",
		color: "var(--chart-5)",
	},
	Informatikk__robotikk_og_intelligente_systemer: {
		label: "Robotikk",
		color: "var(--chart-1)",
	},
	Elektronikk_informatikk_og_teknologi: {
		label: "Elektronikk, informatikk og teknologi",
		color: "var(--chart-2)",
	},
	Matematikk_med_informatikk: {
		label: "Matematikk med informatikk",
		color: "var(--chart-3)",
	},
	Informasjonssikkerhet: {
		label: "Infosek",
		color: "var(--chart-4)",
	},
	Computational_science: {
		label: "Computational Science",
		color: "var(--chart-5)",
	},
	Data_Science: {
		label: "Data Science",
		color: "var(--chart-1)",
	},
	Entreprenørskap_og_innovasjonsledelse: {
		label: "Entreprenørskap og innovasjonsledelse",
		color: "var(--chart-2)",
	},
	Digitalisering_i_helsesektoren: {
		label: "Dighel",
		color: "var(--chart-3)",
	},
	Informatikk__årsenhet_: {
		label: "Informatikk (årsenhet)",
		color: "var(--chart-5)",
	},
	It_arkitektur_årsenhet: {
		label: "IT-arkitektur (årsenhet)",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

export default function ProgramsChart({
	chartData,
}: Readonly<{
	chartData: {
		program: string;
		num: number;
		fill: string;
	}[];
}>) {
	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>Antall studenter per program</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-[320px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
				>
					<PieChart>
						<ChartTooltip content={<ChartTooltipContent />} />
						<ChartLegend
							content={
								<ChartLegendContent
									nameKey="value"
									verticalAlign="top"
									className="flex-wrap gap-1"
								/>
							}
						/>
						<Pie data={chartData} dataKey="num" label nameKey="program" />
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
