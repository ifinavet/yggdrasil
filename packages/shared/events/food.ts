export const FOOD_ITEMS = [
	"pizza",
	"sushi",
	"burritos",
	"taco",
	"wraps",
	"burger",
	"baguettes",
	"asian",
	"salad",
	"cake",
	"coffee_snacks",
	"other",
] as const;
export type FoodItem = (typeof FOOD_ITEMS)[number];

export const FOOD_ITEM_LABELS: Record<FoodItem, string> = {
	pizza: "🍕 Pizza",
	sushi: "🍣 Sushi",
	burritos: "🌯 Burritos",
	taco: "🌮 Taco",
	wraps: "🥙 Wraps",
	burger: "🍔 Burger",
	baguettes: "🥖 Baguetter",
	asian: "🍜 Asiatisk",
	salad: "🥗 Salat",
	cake: "🍰 Kake",
	coffee_snacks: "☕ Kaffe og snacks",
	other: "🍽️ Annet",
};

const FOOD_KEYWORDS: Record<Exclude<FoodItem, "other">, readonly string[]> = {
	pizza: ["pizza"],
	sushi: ["sushi"],
	burritos: ["burrito"],
	taco: ["taco"],
	wraps: ["wrap"],
	burger: ["burger"],
	baguettes: ["baguett", "bagett"],
	asian: ["asiatisk", "thai", "wok", "nudler", "ramen", "dumpling"],
	salad: ["salat"],
	cake: ["kake"],
	coffee_snacks: ["kaffe", "snacks"],
};

export function guessFoodItem(text: string | undefined): FoodItem | null {
	const normalized = text?.trim().toLocaleLowerCase("nb") ?? "";
	if (!normalized) return null;
	const matches = Object.entries(FOOD_KEYWORDS)
		.filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
		.map(([item]) => item as FoodItem);
	return matches.length === 1 ? (matches[0] ?? null) : null;
}
