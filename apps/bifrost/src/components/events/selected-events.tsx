"use client";


import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useMutation } from "convex/react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { useSelectedEventsStore } from "@/lib/stores/selected-events";
import { humanReadableDate } from "@/utils/utils";

export default function SelectedEvents() {
	const posthog = usePostHog();

	const router = useRouter();

	const selectedEvents = useSelectedEventsStore((state) => state.events);
	const clearSelectedEvents = useSelectedEventsStore((state) => state.clearEvents);

	const updateSelectedEvents = useMutation(api.events.updatePublishedStatus);
	const publishSelectedEvents = () =>
		updateSelectedEvents({ ids: selectedEvents, newPublishedStatus: true })
			.then(() => {
				toast.success(`Publiserte ${selectedEvents.length} arrangementer!`, {
					description: humanReadableDate(new Date()),
				});

				clearSelectedEvents();
				router.refresh();
			})
			.catch((error) => {
				toast.error("Noe gikk galt med publisering!", {
					description: error.message,
				});

				posthog.captureException(error, { site: "midgard" });
			});

	const unpublishSelectedEvents = () =>
		updateSelectedEvents({ ids: selectedEvents, newPublishedStatus: false })
			.then(() => {
				toast.success(`Avpubliserte ${selectedEvents.length} arrangementer!`, {
					description: humanReadableDate(new Date()),
				});

				clearSelectedEvents();
				router.refresh();
			})
			.catch((error) => {
				toast.error("Noe gikk galt med avpublisering!", {
					description: error.message,
				});

				posthog.captureException(error, { site: "midgard" });
			});

	return (
		selectedEvents.length > 0 && (
			<div className="flex gap-4">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="group">
							Oppdater {selectedEvents.length} valgte arrangementer
							<ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem onClick={publishSelectedEvents}>
							Publisher alle valgte
						</DropdownMenuItem>
						<DropdownMenuItem onClick={unpublishSelectedEvents}>
							Avpublisher alle valgte
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		)
	);
}
