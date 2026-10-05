import { Button } from "@workspace/ui/components/button";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function ProfileConfirmation({
	program,
	year,
	confirmed,
	editing,
	onConfirm,
	onEdit,
	children,
}: Readonly<{
	program: string;
	year: string | number;
	confirmed: boolean;
	editing: boolean;
	onConfirm: () => void;
	onEdit: () => void;
	children: ReactNode;
}>) {
	return (
		<section className="rounded-xl bg-muted p-5" aria-label="Studieopplysninger">
			<p className="mb-3 text-sm">Vi har registrert dette på deg:</p>
			<p className="font-medium">
				{program}
				<span className="mt-1 block text-sm">{year}. år</span>
			</p>
			{editing ? (
				<div className="mt-5 flex flex-col gap-4">{children}</div>
			) : (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					{confirmed ? (
						<output className="inline-flex items-center gap-2 text-sm">
							<Check size={16} />
							Bekreftet
						</output>
					) : (
						<>
							<span className="text-sm">Stemmer dette?</span>
							<Button type="button" size="sm" onClick={onConfirm}>
								Ja
							</Button>
						</>
					)}
					<Button type="button" variant="outline" size="sm" onClick={onEdit}>
						{confirmed ? "Endre" : "Nei, endre"}
					</Button>
				</div>
			)}
		</section>
	);
}
