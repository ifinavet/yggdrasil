"use client";
import type { RegistrantStatistics } from "@workspace/shared/feedback/report";
import { fromBase64, toVariableName } from "@workspace/shared/utils";
import DegreeChart from "./degree-chart";
import ProgramsChart from "./programs-chart";
import DegreeTable from "./degree-table";

export function RegistrationStatistics({ data }: Readonly<{ data: RegistrantStatistics }>) {
	const degreeTotals = Object.entries(data).map(([degree, programs]) => {
		const num = Object.values(programs).reduce((acc, aar) => {
			const sum = Object.values(aar).reduce((a, b) => a + b, 0);
			return acc + sum;
		}, 0);
		return {
			degree: fromBase64(degree).toLowerCase(),
			num,
			fill: `var(--color-${fromBase64(degree).toLowerCase()})`,
		};
	});

	const programTotals = Object.entries(
		Object.values(data).reduce<Record<string, number>>((acc, programs) => {
			for (const [program, aar] of Object.entries(programs)) {
				const sum = Object.values(aar).reduce((a, b) => a + b, 0);
				acc[program] = (acc[program] ?? 0) + sum;
			}
			return acc;
		}, {}),
	)
		.map(([baseProgram, num]) => {
			return {
				program: toVariableName(fromBase64(baseProgram)),
				num,
				fill: `var(--color-${toVariableName(fromBase64(baseProgram))})`,
			};
		})
		.sort((a, b) => b.num - a.num);

	return (
		<section className="space-y-4" aria-label="Grader og studieretninger">
			<h3 className="font-semibold text-xl">Grader og studieretninger</h3>
			{degreeTotals.length === 0 ? (
				<p>Ingen registrerte deltakere.</p>
			) : (
				<>
					<div className="grid min-w-0 gap-4 @min-[600px]:grid-cols-2">
						<DegreeChart chartData={degreeTotals} />
						<ProgramsChart chartData={programTotals} />
					</div>
					<DegreeTable data={data} />
				</>
			)}
		</section>
	);
}
