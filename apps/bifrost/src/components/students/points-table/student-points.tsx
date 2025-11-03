"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { humanReadableDate } from "@/utils/utils";
import { createColumns } from "./columns";
import { PointsTable } from "./points-table";

export default function StudentPoints({
	student_id,
}: Readonly<{ student_id: Id<"students"> }>) {
	const points = useQuery(api.points.getByStudentId, { id: student_id });
	const deletePoint = useMutation(api.points.remove);

	const posthog = usePostHog();

	if (!points) {
		return <div>Loading...</div>;
	}

	const handleDeletePoint = async (pointId: Id<"points">) =>
		deletePoint({ id: pointId })
			.then(() => {
				toast.success("Prikk fjernet vellykket", {
					description: humanReadableDate(new Date()),
				});

				posthog.capture("bifrost-point_deleted", {
					point_id: pointId,
					student_id: student_id,
				});
			})
			.catch((error) => {
				toast.error("Oi! Det opstod en feil! Prøv igjen senere", {
					description: error.message,
				});
			});

	const columns = createColumns((pointsId) => handleDeletePoint(pointsId));
	const data = points.map((point) => ({
		pointId: point._id,
		severity: point.severity,
		reason: point.reason,
		awardedTime: new Date(point._creationTime),
	}));

	return <PointsTable columns={columns} data={data} />;
}
