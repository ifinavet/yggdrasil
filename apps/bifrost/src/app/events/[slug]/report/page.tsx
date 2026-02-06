import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { fromBase64, toVariableName } from "@workspace/shared/utils";
import { fetchQuery } from "convex/nextjs";
import DegreeChart from "@/components/events/report/degree-chart";
import ProgramsChart from "@/components/events/report/programs-chart";
import DegreeTables from "@/components/events/report/table";

export default async function RapportPage({
  params,
}: Readonly<{ params: Promise<{ slug: Id<"events"> }> }>) {
  const { slug } = await params;

  const registrantsInfo = await fetchQuery(api.registration.getRegistrantsInfo, { eventId: slug });

  const degreeTotals = Object.entries(registrantsInfo).map(([degree, programs]) => {
    const num = Object.values(programs).reduce((acc, aar) => {
      const sum = Object.values(aar).reduce((a, b) => a + b, 0);
      return acc + sum;
    }, 0);
    return {
      degree: degree.toLowerCase(),
      num,
      fill: `var(--color-${degree.toLowerCase()})`,
    };
  });

  const programTotals = Object.entries(
    Object.values(registrantsInfo).reduce<Record<string, number>>((acc, programs) => {
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
    <div className="space-y-4">
      <h3 className="border-b pb-2 font-semibold text-3xl tracking-tight">
        Bedriftspresentasjons rapport
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <DegreeChart chartData={degreeTotals} />
        <ProgramsChart chartData={programTotals} />
      </div>
      <DegreeTables data={registrantsInfo} />
    </div>
  );
}
