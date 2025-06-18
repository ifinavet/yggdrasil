import { OrganizationProfile, UserProfile } from "@clerk/nextjs";

export default function Profile() {
	return (
		<div>
			<UserProfile />
			<OrganizationProfile />
		</div>
	);
}
