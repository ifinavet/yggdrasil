"use client";

import { Button } from "@workspace/ui/components/button";

export default function RegisterAttendanceByQr({
	onRegisterAction,
}: {
	onRegisterAction: (newStatus: "confirmed" | "late") => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button type="submit" onClick={() => onRegisterAction("confirmed")}>
				Oppmøtt
			</Button>
			<Button type="submit" variant="outline" onClick={() => onRegisterAction("late")}>
				Møtt sent
			</Button>
		</div>
	);
}
