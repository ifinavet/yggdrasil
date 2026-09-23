"use client";
import type { RegistrantStatistics } from "@workspace/shared/feedback/report";
import DegreeTable from "@workspace/ui/components/feedback/degree-table";
import { downloadCSV } from "@/utils/csv-creator";
export default function DegreeTables({ data }: Readonly<{ data: RegistrantStatistics }>) {
	return <DegreeTable data={data} onExport={() => downloadCSV(data, "grades.csv")} />;
}
