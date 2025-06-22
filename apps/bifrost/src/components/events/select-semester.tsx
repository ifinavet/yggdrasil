"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components//select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { getPossibleSemestes } from "@/lib/queries/events";

export default function SelectSemester() {
  const router = useRouter();
  const path = usePathname();
  const searchParams = useSearchParams();

  const { data: semesters } = useQuery({
    queryKey: ["possible_semesters"],
    queryFn: getPossibleSemestes,
  });

  const updateSemester = useCallback(
    (semester: string, year: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("semester", semester);
      params.set("year", year.toString());
      return params.toString();
    },
    [searchParams],
  );

  const year = searchParams.get("year") || new Date().getFullYear();
  const semester = searchParams.get("semester") || (new Date().getMonth() < 6 ? "vår" : "høst");

  return (
    <Select
      defaultValue={`${year} ${semester}`}
      onValueChange={(value) => {
        const parts = value.split(" ");
        const semesterPart = parts[1];
        const yearPart = parts[0];
        if (semesterPart && yearPart) {
          router.push(`${path}?${updateSemester(semesterPart, parseInt(yearPart))}`);
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder='Velg et semester' />
      </SelectTrigger>
      <SelectContent>
        {semesters?.map(({ year, semester }) => (
          <SelectItem key={year + semester} value={`${year} ${semester}`}>
            {year} {semester}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
