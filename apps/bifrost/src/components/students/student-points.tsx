"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useQuery } from "convex/react";
import { humanReadableDate } from "@/utils/utils";

export default function StudentPoints({ student_id }: { student_id: Id<"students"> }) {
  const points = useQuery(api.points.getByStudentId, { id: student_id });

  if (!points) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <ul>
        {points?.map((point) => (
          <li key={point._id}>
            {humanReadableDate(new Date(point._creationTime))}: {point.reason} (
            {point.severity})
          </li>
        ))}
      </ul>
    </div>
  );
}
