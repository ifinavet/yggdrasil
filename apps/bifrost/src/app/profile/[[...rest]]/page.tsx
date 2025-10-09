import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components//button";
import { DynamicUserProfile } from "@/components/profile/dynamic-clerk-components";

export default async function Profile() {
	return (
		<div className="flex flex-col justify-start gap-4">
			<div className="flex flex-wrap gap-4">
				<DynamicUserProfile />
			</div>
			<div>
				<Button asChild variant="destructive">
					<SignOutButton>Logg ut</SignOutButton>
				</Button>
			</div>
		</div>
	);
}
