"use client";

import { fromBase64 } from "@workspace/shared/utils";

export function downloadCSV(
  data: Record<string, Record<string, Record<string, number>>>,
  filename: string = "grades.csv",
) {
  if (typeof window === "undefined") return;

  const rows: string[] = [];
  rows.push("Grad,Linje,År,Antall");

  for (const level in data) {
    const subjects = data[level];
    for (const subject in subjects) {
      const grades = subjects[subject];
      for (const grade in grades) {
        const count = grades[grade];
        const row = `"${level}","${fromBase64(subject)}","${grade}","${count}"`;
        rows.push(row);
      }
    }
  }

  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
