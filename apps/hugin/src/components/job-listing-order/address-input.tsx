"use client";
import { api } from "@workspace/backend/convex/api";
import { AddressInput as SharedAddressInput } from "@workspace/ui/components/address-input";
import { useAction } from "convex/react";
import type { ComponentProps } from "react";
export function AddressInput(
	props: Omit<ComponentProps<typeof SharedAddressInput>, "searchAddresses">,
) {
	const searchAddresses = useAction(api.jobListingOrders.addressSearch.searchAddresses);
	return <SharedAddressInput {...props} searchAddresses={searchAddresses} />;
}
