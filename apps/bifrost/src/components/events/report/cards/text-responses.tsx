import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";

export default function TextResponseCard({
	data,
	filterKey,
	title,
	description,
}: {
	data: Record<string, string>[];
	filterKey: string;
	title: string;
	description: string;
}) {
	const values = data
		.map((item) => item[filterKey])
		.filter((value) => value !== undefined && value !== "");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="max-h-96 overflow-y-scroll">
				{values.length === 0 && (
					<div>Her var det tomt... Ser ikke ut til at noen hadde noen tanker om dette punktet.</div>
				)}
				{values.map((value, index) => (
					<div key={`response-${index ** 2}`} className="mb-2 rounded-lg bg-accent px-2 py-4">
						{value}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
