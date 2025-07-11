"use client";

import { useQuery } from "@tanstack/react-query";
import { getStudentsPointsById } from "@/lib/queries/students";
import { humanReadableDate } from "@/utils/utils";

export default function StudentPoints({ user_id }: { user_id: string }) {
	const { data: points, isLoading } = useQuery({
		queryKey: ["studentPoints", user_id],
		queryFn: () => getStudentsPointsById(user_id),
	});

	if (!points || isLoading) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<ul>
				{points?.map((point) => (
					<li key={point.point_id}>
						{humanReadableDate(new Date(point?.awarded_time || ""))}: {point.reason} (
						{point.severity})
					</li>
				))}
			</ul>
		</div>
	);
}
