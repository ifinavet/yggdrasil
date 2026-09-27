"use client";

import { degreeName } from "@workspace/shared/constants";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import React, { useState } from "react";

type DegreeTablesProps = {
	data: Record<string, Record<string, Record<number, number>>>;
	onExport?: () => void;
};

export default function DegreeTables({ data, onExport }: Readonly<DegreeTablesProps>) {
	const [selectedDegree, setSelectedDegree] = useState<string>(Object.keys(data)[0] || "Bachelor");

	return (
		<div className="my-2">
			<Tabs defaultValue={selectedDegree} onValueChange={setSelectedDegree}>
				<div className="flex w-full justify-between">
					<TabsList>
						{Object.keys(data).map((degree) => (
							<TabsTrigger value={degree} key={degree}>
								{degreeName(degree)}
							</TabsTrigger>
						))}
					</TabsList>
					{onExport ? (
						<Button type="button" onClick={onExport}>
							Last ned CSV
						</Button>
					) : null}
				</div>
				<TabsContent value={selectedDegree}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Studieprogram</TableHead>
								<TableHead>År</TableHead>
								<TableHead>Antall</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Object.entries(data[selectedDegree] || {}).map(([program, semesters]) => (
								<React.Fragment key={program}>
									<TableRow>
										<TableCell colSpan={3}>{fromBase64(program)}</TableCell>
									</TableRow>
									{Object.entries(semesters).map(([aar, count]) => (
										<TableRow key={aar}>
											<TableCell></TableCell>
											<TableCell>{aar}</TableCell>
											<TableCell>{count}</TableCell>
										</TableRow>
									))}
								</React.Fragment>
							))}
						</TableBody>
					</Table>
				</TabsContent>
			</Tabs>
		</div>
	);
}
