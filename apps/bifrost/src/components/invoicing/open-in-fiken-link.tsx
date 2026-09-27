import { Button } from "@workspace/ui/components/button";
import { ExternalLink } from "lucide-react";
import { INVOICE_ROUTES } from "./invoice-routes";

export function OpenInFikenLink() {
	return (
		<Button asChild variant="outline" size="sm">
			<a href={INVOICE_ROUTES.fiken} target="_blank" rel="noopener noreferrer">
				Åpne Fiken
				<ExternalLink className="size-3.5" />
			</a>
		</Button>
	);
}
