import type { FOOD_PURCHASERS, VENUES } from "./labels";

/** The answers in an application that decide what Navet has to arrange for the event. */
export type LogisticsAnswers = {
	venue: (typeof VENUES)[number];
	foodAndDrinks: boolean;
	foodPurchasedBy: (typeof FOOD_PURCHASERS)[number];
};

/**
 * What Navet must arrange for a company's event, from the company's own answers. A room is booked
 * unless the company hosts in its own premises; while the venue is undecided, one is kept in mind.
 * Food is ordered when there is food and Navet buys it, or it is not yet decided who does.
 */
export function logisticsNeeds({ venue, foodAndDrinks, foodPurchasedBy }: LogisticsAnswers): {
	room: boolean;
	food: boolean;
} {
	return {
		room: venue !== "own_premises",
		food: foodAndDrinks && foodPurchasedBy !== "company",
	};
}
