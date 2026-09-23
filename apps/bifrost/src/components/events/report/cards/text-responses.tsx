import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";

export default function TextResponseCard({
	responses,
	filterKey,
	title,
	description,
}: Readonly<{
	responses: readonly { readonly _id: string; readonly data: Record<string, string> }[];
	filterKey: string;
	title: string;
	description: string;
}>) {
	const answers = responses
		.map((response) => ({ id: response._id, text: response.data[filterKey] }))
		.filter((answer) => answer.text !== undefined && answer.text !== "");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="max-h-96 overflow-y-scroll">
				{answers.length === 0 && (
					<div>Her var det tomt... Ser ikke ut til at noen hadde noen tanker om dette punktet.</div>
				)}
				{answers.map((answer) => (
					<div key={answer.id} className="mb-2 rounded-lg bg-accent px-2 py-4">
						{answer.text}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
