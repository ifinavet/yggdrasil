"use client";

import { fromBase64 } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import React, { useState } from "react";
import { downloadCSV } from "@/utils/csv-creator";

type DegreeTablesProps = {
	data: Record<string, Record<string, Record<number, number>>>;
};

export default function DegreeTables({ data }: Readonly<DegreeTablesProps>) {
	const [selectedDegree, setSelectedDegree] = useState<string>(
		Object.keys(data)[0] || "Bachelor",
	);

	return (
		<div className="my-2">
			<Tabs defaultValue={selectedDegree} onValueChange={setSelectedDegree}>
				<div className="flex w-fll justify-between">
					<TabsList>
						{Object.keys(data).map((degree) => (
							<TabsTrigger value={degree} key={degree}>
								{degree}
							</TabsTrigger>
						))}
					</TabsList>
					<Button type="button" onClick={() => downloadCSV(data, "grades.csv")}>
						Last ned CSV
					</Button>
				</div>
				<TabsContent value={selectedDegree}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Studieprogram</TableHead>
								<TableHead>Semester</TableHead>
								<TableHead>Antall</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Object.entries(data[selectedDegree] || {}).map(
								([program, semesters]) => (
									<React.Fragment key={program}>
										<TableRow>
											<TableCell colSpan={3}>{fromBase64(program)}</TableCell>
										</TableRow>
										{Object.entries(semesters).map(([semester, count]) => (
											<TableRow key={semester}>
												<TableCell></TableCell>
												<TableCell>{semester}</TableCell>
												<TableCell>{count}</TableCell>
											</TableRow>
										))}
									</React.Fragment>
								),
							)}
						</TableBody>
					</Table>
				</TabsContent>
			</Tabs>
		</div>
	);
}
