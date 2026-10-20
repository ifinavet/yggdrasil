import { Suspense } from "react";
import { WikiHome } from "@/components/wiki/home";
import { WikiLoading } from "@/components/wiki/shared";
export default function WikiPage() {
	return (
		<Suspense fallback={<WikiLoading />}>
			<WikiHome />
		</Suspense>
	);
}
