"use client";

import { Scanner, type ScannerErrorKind } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<ScannerErrorKind, string> = {
	"permission-denied": "Kameraet mangler tillatelse. Gi tilgang og prøv igjen.",
	"no-camera": "Fant ingen kamera på denne enheten.",
	"in-use": "Kameraet er i bruk av en annen app eller fane.",
	overconstrained: "Kameraet støtter ikke de nødvendige innstillingene.",
	"insecure-context": "Kameraet krever en sikker tilkobling (HTTPS).",
	unsupported: "Nettleseren støtter ikke kamerabruk.",
	aborted: "Kameraet ble avbrutt. Prøv igjen.",
	security: "Nettleseren blokkerte tilgang til kameraet.",
	"type-error": "Kunne ikke starte kameraet med disse innstillingene.",
	unknown: "Kunne ikke starte skanneren.",
};

export default function QRScannerControlled({
	onDecodedAction,
}: Readonly<{
	onDecodedAction: (text: string) => void;
}>) {
	return (
		<div className="grid max-w-[480px] gap-2">
			<Scanner
				formats={["qr_code"]}
				constraints={{ facingMode: "environment" }}
				components={{ finder: true, onOff: true }}
				classNames={{
					container:
						"relative aspect-square w-full overflow-hidden rounded-lg bg-black",
					video: "h-full w-full object-cover",
				}}
				onScan={(codes) => {
					const value = codes[0]?.rawValue;
					if (value) onDecodedAction(value);
				}}
				onError={(error) => toast.error(ERROR_MESSAGES[error.kind])}
			/>
		</div>
	);
}
