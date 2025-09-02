import { api } from "@workspace/backend/convex/api";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { QRCodeSVG } from "qrcode.react";
import NavetLogo from "@/assets/navet/navet-n-circle.webp";
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
				<div className="mx-auto overflow-clip rounded-lg">
					<QRCodeSVG
						value={currentUsersRegistration._id}
						size={256}
						fgColor='#2f3e5f'
						imageSettings={{
							src: NavetLogo.src,
							height: 128,
							width: 128,
							excavate: true,
						}}
					/>
				</div>
			</ContainerCard>
		)
	);
}
