import { formatOfferCost, productParagraphs } from "@workspace/shared/products";
import type { ReactNode } from "react";

export function OfferCard({
	title,
	cost,
	children,
}: Readonly<{
	title: string;
	cost?: string;
	children: ReactNode;
}>) {
	return (
		<div className="overflow-clip rounded-lg bg-white shadow-md dark:bg-zinc-800">
			<div className="flex h-48 flex-col justify-between bg-primary p-8 text-primary-foreground">
				<h3 className="max-w-3/4 font-semibold text-2xl">{title}</h3>
				{cost && <p className="">Kostnad: {cost} NOK eks. mva.</p>}
			</div>
			<div className="max-w-[80ch] p-6">
				<ul className="my-6 ml-6 list-disc [&>li]:mt-2 [&>li]:leading-7">{children}</ul>
			</div>
		</div>
	);
}

export type OfferProduct = {
	name: string;
	longDescription: string;
	unitPriceOre?: number;
};

export function ProductOfferCard({
	product,
	lastItemSuffix,
}: Readonly<{ product: OfferProduct; lastItemSuffix?: ReactNode }>) {
	const paragraphs = productParagraphs(product.longDescription);
	const lastIndex = paragraphs.length - 1;

	return (
		<OfferCard
			title={product.name}
			cost={product.unitPriceOre === undefined ? undefined : formatOfferCost(product.unitPriceOre)}
		>
			{paragraphs.map((paragraph, index) => (
				<li key={paragraph}>
					{paragraph}
					{index === lastIndex && lastItemSuffix && <> {lastItemSuffix}</>}
				</li>
			))}
		</OfferCard>
	);
}
