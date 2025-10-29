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
	informatikk_programmering_og_systemarkitektur: {
		label: "Prosa",
		color: "var(--chart-1)",
	},
	informatikk_design_bruk_og_interaksjon: {
		label: "Design",
		color: "var(--chart-2)",
	},
	informatikk_digital_oekonomi_og_ledelse: {
		label: "Digøk",
		color: "var(--chart-3)",
	},
	informatikk_spraakteknologi: {
		label: "Språktek",
		color: "var(--chart-4)",
	},
	informatikk_maskinlaering_og_kunstig_intelligens: {
		label: "Maki",
		color: "var(--chart-5)",
	},
	informatikk_robotikk_og_intelligente_systemer: {
		label: "Robotikk",
		color: "var(--chart-1)",
	},
	ilektronikk_informatikk_og_teknologi: {
		label: "Elektronikk, informatikk og teknologi",
		color: "var(--chart-2)",
	},
	iatematikk_med_informatikk: {
		label: "Matematikk med informatikk",
		color: "var(--chart-3)",
	},
	informasjonssikkerhet: {
		label: "Infosek",
		color: "var(--chart-4)",
	},
	iomputational_Science: {
		label: "Computational Science",
		color: "var(--chart-5)",
	},
	data_Science: {
		label: "Data Science",
		color: "var(--chart-1)",
	},
	entreprenoerskap_og_innovasjonsledelse: {
		label: "Entreprenørskap og innovasjonsledelse",
		color: "var(--chart-2)",
	},
	digitalisering_i_helsesektoren: {
		label: "Dighel",
		color: "var(--chart-3)",
	},
	informatikk_aarsenhet: {
		label: "Informatikk (årsenhet)",
		color: "var(--chart-4)",
	},
	it_arkitektur_årsenhet: {
		label: "IT-arkitektur (årsenhet)",
		color: "var(--chart-5)",
	},
} satisfies ChartConfig;

export default function DegreeChart({
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
