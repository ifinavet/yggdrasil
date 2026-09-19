import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

export type SubmitAction = "primary" | "secondary" | "tertiary";

export type SubmitActionLabel = {
	readonly label: string;
	readonly icon: ReactNode;
};

export default function FormSubmitActions({
	isSubmitting,
	onSubmitAction,
	primary,
	secondary,
	tertiary,
	className,
}: Readonly<{
	isSubmitting: boolean;
	onSubmitAction: (action: SubmitAction) => void;
	primary: SubmitActionLabel;
	secondary: SubmitActionLabel;
	tertiary?: SubmitActionLabel;
	className?: string;
}>) {
	return (
		<div className={cn("flex gap-4", className)}>
			<Button type="button" disabled={isSubmitting} onClick={() => onSubmitAction("primary")}>
				{primary.icon} {isSubmitting ? "Jobber..." : primary.label}
			</Button>
			<Button
				type="button"
				variant="secondary"
				disabled={isSubmitting}
				onClick={() => onSubmitAction("secondary")}
			>
				{secondary.icon} {isSubmitting ? "Jobber..." : secondary.label}
			</Button>
			{tertiary && (
				<Button
					type="button"
					variant="destructive"
					disabled={isSubmitting}
					onClick={() => onSubmitAction("tertiary")}
				>
					{tertiary.icon} {isSubmitting ? "Jobber..." : tertiary.label}
				</Button>
			)}
		</div>
	);
}
