"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { OrderReviewDialog } from "./order-review-dialog";
import { useJobListingOrdersEnabled } from "./use-job-listing-orders-enabled";

export function PendingOrdersAlert() {
	const enabled = useJobListingOrdersEnabled();
	const orders = useQuery(api.jobListingOrders.admin.listPending, enabled ? {} : "skip");
	const [openOrderId, setOpenOrderId] = useState<Id<"jobListingOrders">>();

	if (!orders?.length) return null;

	return (
		<div className="flex flex-col gap-3 rounded-lg bg-primary-light px-5 py-4 dark:bg-accent">
			<p className="font-medium">
				{orders.length === 1
					? "1 bestilling venter på godkjenning"
					: `${orders.length} bestillinger venter på godkjenning`}
			</p>
			<ul className="flex flex-col gap-1">
				{orders.map((order) => (
					<li key={order._id}>
						<button
							type="button"
							onClick={() => setOpenOrderId(order._id)}
							className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left hover:bg-background/60"
						>
							<span className="font-medium">{order.companyName}</span>
							<span className="text-muted-foreground text-sm">{order.reference}</span>
							<span className="text-muted-foreground text-sm">
								{order.quantity === 1 ? "1 annonse" : `${order.quantity} annonser`}
							</span>
							{order.newCompany && <Badge variant="secondary">Ny bedrift</Badge>}
							{order.updatePending && <Badge variant="outline">Endring venter</Badge>}
							<ChevronRight className="ml-auto size-4 text-muted-foreground" />
						</button>
					</li>
				))}
			</ul>
			<OrderReviewDialog orderId={openOrderId} onClose={() => setOpenOrderId(undefined)} />
		</div>
	);
}
