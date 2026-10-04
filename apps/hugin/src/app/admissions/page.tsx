import { isLocalDevelopment } from "@workspace/auth/local";
import { OSLO_TIME_ZONE } from "@workspace/shared/time";
import { notFound } from "next/navigation";
import ApplicationPreview from "./application-preview";
export default async function Page({
	searchParams,
}: Readonly<{
	searchParams: Promise<{ preview?: string }>;
}>) {
	if (!isLocalDevelopment) notFound();
	const { preview } = await searchParams;
	// Local fixture until admission periods are backed by the admissions API.
	const now = new Date();
	const open =
		now >= new Date("2026-10-01T00:00:00+02:00") && now < new Date("2026-10-12T00:00:00+02:00");
	if ((!open && preview !== "open") || preview === "closed") {
		const month = Number(
			new Intl.DateTimeFormat("en", { month: "numeric", timeZone: OSLO_TIME_ZONE }).format(now),
		);
		return (
			<div className="mx-auto max-w-xl py-16">
				<h1 className="font-semibold text-3xl">Søknadsperioden er avsluttet</h1>
				<p className="mt-4 text-base leading-relaxed">
					Søknadsperioden for dette semesteret er ferdig. Neste opptak åpner i starten av{" "}
					{month < 7 ? "høstsemesteret" : "vårsemesteret"}.
				</p>
			</div>
		);
	}
	return <ApplicationPreview />;
}
