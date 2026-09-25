"use client";

import type { api } from "@workspace/backend/convex/api";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { AcceptOfferForm } from "./accept-offer-form";
import { DeclineOfferForm } from "./decline-offer-form";
import {
	AcceptedOffer,
	DeclinedOffer,
	InactiveOffer,
	NewDateRequested,
	SupersededOffer,
	UnknownOffer,
} from "./offer-states";
import { RequestNewDateForm } from "./request-new-date-form";

type OfferResult = FunctionReturnType<typeof api.semesterPlanning.offers.queries.getByToken>;
export type KnownOffer = Exclude<OfferResult, { state: "unknown" }>;

/**
 * The offer page a company reaches from the link Navet sends it. The query is live, so the page moves to
 * the answered state as soon as an answer is saved, here or in another tab.
 */
export function CompanyOffer({
	token,
	preloadedOffer,
}: Readonly<{
	token: string;
	preloadedOffer: Preloaded<typeof api.semesterPlanning.offers.queries.getByToken>;
}>) {
	const offer = usePreloadedQuery(preloadedOffer);
	// The answer step shown on top of an open offer. A state change from the live query wins.
	const [step, setStep] = useState<"offer" | "new-date" | "decline">("offer");
	const backToOffer = () => setStep("offer");

	const content = (() => {
		switch (offer.state) {
			case "unknown":
				return <UnknownOffer />;
			case "pending":
				if (step === "decline") {
					return <DeclineOfferForm token={token} offer={offer} onBack={backToOffer} />;
				}
				return step === "new-date" ? (
					<RequestNewDateForm
						token={token}
						openDates={offer.openDates ?? []}
						onBack={backToOffer}
					/>
				) : (
					<AcceptOfferForm
						token={token}
						offer={offer}
						onAskForNewDate={() => setStep("new-date")}
						onDecline={() => setStep("decline")}
					/>
				);
			case "accepted":
				return <AcceptedOffer offer={offer} />;
			case "new_date_requested":
				return step === "decline" ? (
					<DeclineOfferForm token={token} offer={offer} onBack={backToOffer} />
				) : (
					<NewDateRequested offer={offer} onDecline={() => setStep("decline")} />
				);
			case "declined":
				return <DeclinedOffer offer={offer} />;
			case "superseded":
				return <SupersededOffer />;
			case "inactive":
				return <InactiveOffer offer={offer} />;
		}
	})();

	return <div className="mx-auto w-full max-w-xl text-pretty lg:w-xl">{content}</div>;
}
