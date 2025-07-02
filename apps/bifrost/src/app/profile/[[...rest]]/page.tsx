import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components//button";
import {
	DynamicOrganizationProfile,
	DynamicUserProfile,
} from "@/components/profile/dynamic-clerk-components";

export default async function Profile() {
	const { orgRole } = await auth();

	return (
		<div className='flex flex-col justify-start gap-4'>
			<div className='flex flex-wrap gap-4'>
				<DynamicUserProfile />
				{orgRole === "org:admin" && <DynamicOrganizationProfile />}
			</div>
			<div>
				<Button asChild variant='destructive'>
					<SignOutButton>Logg ut</SignOutButton>
				</Button>
			</div>
		</div>
	);
}
