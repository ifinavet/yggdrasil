"use client";

import {
	BrowserMultiFormatReader,
	type IScannerControls,
} from "@zxing/browser";

type Result = { getText(): string };

import { Button } from "@workspace/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import {
	Pause as PauseIcon,
	Play,
	QrCode,
	RefreshCw,
	Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Cam = { deviceId: string; label: string };

export default function QRScannerControlled({
	onDecodedAction,
}: Readonly<{
	onDecodedAction: (text: string) => void;
}>) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const controlsRef = useRef<IScannerControls | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const [cams, setCams] = useState<Cam[]>([]);
	const [selectedCam, setSelectedCam] = useState<string | undefined>(undefined);
	const [running, setRunning] = useState(false);
	const [paused, setPaused] = useState(false);
	const [snapshot, setSnapshot] = useState<string | null>(null);

	// Enumerate cameras
	const loadCameras = useCallback(async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const vids = devices
				.filter((d) => d.kind === "videoinput")
				.map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
			setCams(vids);
			if (!selectedCam && vids[0]) setSelectedCam(vids[0].deviceId);
		} catch {
			toast.error("Kunne ikke hente kameraer. Krever tillatelse?");
		}
	}, [selectedCam]);

	// Start scanning with a specific camera
	const start = useCallback(async () => {
		if (!videoRef.current || !selectedCam) return;
		stop(); // ensure clean state

		setPaused(false);

		const reader = new BrowserMultiFormatReader();

		try {
			const controls = await reader.decodeFromVideoDevice(
				selectedCam,
				videoRef.current,
				(res?: Result) => {
					if (res) {
						const text = res.getText();
						onDecodedAction(text);
					}
				},
			);
			controlsRef.current = controls;

			// Grab the active stream from the video element for pause/resume control
			streamRef.current = (videoRef.current.srcObject as MediaStream) ?? null;

			setRunning(true);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Ukjent feil.";
			toast.error(`Kunne ikke starte skanneren. ${message}`);
			stop();
		}
	}, [selectedCam]);

	// Stop scanning and release camera
	const stop = useCallback(() => {
		controlsRef.current?.stop();
		controlsRef.current = null;

		if (videoRef.current) {
			const s = videoRef.current.srcObject as MediaStream | null;
			if (s) s.getTracks().forEach((t) => t.stop());
			videoRef.current.srcObject = null;
		}
		streamRef.current = null;
		setRunning(false);
		setPaused(false);
		setSnapshot(null);
	}, []);

	// Pause/resume camera tracks without tearing down the scanner
	const pause = useCallback(() => {
		const v = videoRef.current;
		if (!streamRef.current || !v) return;

		// Capture square snapshot of the current frame
		const vw = v.videoWidth;
		const vh = v.videoHeight;
		if (vw > 0 && vh > 0) {
			const size = Math.min(vw, vh);
			const sx = Math.floor((vw - size) / 2);
			const sy = Math.floor((vh - size) / 2);
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
				try {
					const url = canvas.toDataURL("image/png");
					setSnapshot(url);
				} catch {
					// ignore
				}
			}
		}

		streamRef.current.getVideoTracks().forEach((t) => {
			t.enabled = false;
		});
		setPaused(true);
	}, []);

	const resume = useCallback(() => {
		if (!streamRef.current) return;
		streamRef.current.getVideoTracks().forEach((t) => {
			t.enabled = true;
		});
		setSnapshot(null);
		setPaused(false);
	}, []);

	// Switch camera: stop current, change deviceId, start again
	const switchCam = useCallback(
		async (deviceId: string) => {
			setSelectedCam(deviceId);
			if (running) {
				await start(); // will call stop() first
			}
		},
		[running, start],
	);

	useEffect(() => {
		(async () => {
			try {
				const s = await navigator.mediaDevices.getUserMedia({
					video: true,
					audio: false,
				});
				s.getTracks().forEach((t) => t.stop());
			} catch {
				// ignore; user will be prompted on start()
			} finally {
				loadCameras();
			}
		})();

		return () => stop();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="grid max-w-[480px] gap-2">
			<div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
				<video
					ref={videoRef}
					playsInline
					className="absolute inset-0 z-0 h-full w-full object-cover"
					aria-label="QR scanner camera preview"
					muted
				>
					<track kind="captions" src="" label="captions" />
				</video>
				{(!running || paused) && (
					<div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-gradient-to-br from-muted/40 to-muted/10">
						<div className="flex flex-col items-center gap-3 text-muted-foreground">
							<div className="rounded-xl border border-border border-dashed bg-background/60 p-6 shadow-sm">
								<QrCode className="h-16 w-16" />
							</div>
							<div className="text-sm">
								{paused
									? "Skanneren er på pause - trykk Forsett for å fortsette"
									: "Klar - trykk Start for å skanne QR-kode"}
							</div>
						</div>
					</div>
				)}
				{paused && snapshot && (
					<img
						src={snapshot}
						alt="Paused snapshot"
						className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover"
					/>
				)}
			</div>

			<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				<Button
					type="button"
					size="lg"
					onClick={running ? stop : start}
					className="w-full sm:w-auto"
				>
					{running ? (
						<>
							<Square className="size-4" /> Stopp
						</>
					) : (
						<>
							<Play className="size-4" /> Start
						</>
					)}
				</Button>
				<Button
					type="button"
					size="lg"
					onClick={paused ? resume : pause}
					disabled={!running}
					variant="outline"
					className="w-full sm:w-auto"
				>
					{paused ? (
						<>
							<Play className="size-4" /> Forsett
						</>
					) : (
						<>
							<PauseIcon className="size-4" /> Pause
						</>
					)}
				</Button>
				<Select value={selectedCam} onValueChange={switchCam}>
					<SelectTrigger
						className="h-11 w-full sm:w-[16rem]"
						disabled={cams.length <= 1 && running}
					>
						<SelectValue placeholder="Velg kamera" />
					</SelectTrigger>
					<SelectContent>
						{cams.map((c, i) => (
							<SelectItem key={c.deviceId} value={c.deviceId}>
								{c.label || `Camera ${i + 1}`}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					type="button"
					size="icon"
					onClick={loadCameras}
					variant="secondary"
					className="w-full sm:w-auto"
				>
					<RefreshCw className="size-4" /> Oppdater
				</Button>
			</div>
		</div>
	);
}
