import { api } from "@workspace/backend/convex/api";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { QRCodeSVG } from "qrcode.react";
import ContainerCard from "@/components/cards/container-card";

export default function QRCode({
	className,
	registrations,
}: {
	className?: string;
	registrations: FunctionReturnType<typeof api.registration.getByEventId>;
}) {
	const { isAuthenticated } = useConvexAuth();
	const currentUser = useQuery(api.users.current, isAuthenticated ? undefined : "skip");
	const currentUsersRegistration = registrations.registered.find(
		(registration) => registration.userId === currentUser?._id,
	);

	return (
		currentUsersRegistration && (
			<ContainerCard className={className}>
				<div className="mx-auto overflow-clip rounded-lg bg-zinc-100 p-4">
					<QRCodeSVG
						value={currentUsersRegistration._id}
						size={256}
						fgColor='#2f3e5f'
						bgColor='#f4f4f5'
					/>
				</div>
			</ContainerCard>
		)
	);
}
