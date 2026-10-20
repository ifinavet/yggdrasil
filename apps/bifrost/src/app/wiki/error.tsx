"use client";
import { Button } from "@workspace/ui/components/button";
export default function WikiError({ retry }: Readonly<{ retry: () => void }>) {
	return (
		<section role="alert" className="rounded-lg border p-6">
			<h1 className="font-semibold text-xl">Håndboken kunne ikke lastes</h1>
			<Button variant="outline" className="mt-3" onClick={retry}>
				Prøv igjen
			</Button>
		</section>
	);
}
