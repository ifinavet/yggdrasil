"use client";

import { api } from "@workspace/backend/convex/api";
import { LOGO_ACCEPT, LOGO_MESSAGES } from "@workspace/shared/logo";
import { Button } from "@workspace/ui/components/button";
import { FieldError } from "@workspace/ui/components/field";
import {
	logoUploadErrorMessage,
	type UploadedLogo,
	uploadLogo,
} from "@workspace/ui/lib/logo-upload";
import { useMutation } from "convex/react";
import Image from "next/image";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { companyCopy } from "@/lib/job-listing-order/copy";

export function useLogoUpload(onUploaded: (logo: UploadedLogo) => void) {
	const generateUploadUrl = useMutation(api.jobListingOrders.form.generateLogoUploadUrl);
	const input = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string>();

	const upload = async (file: File) => {
		setError(undefined);
		setUploading(true);
		try {
			onUploaded(await uploadLogo(file, generateUploadUrl));
		} catch (uploadError) {
			setError(logoUploadErrorMessage(uploadError));
		} finally {
			setUploading(false);
		}
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (file) void upload(file);
	};

	const fileInput = (
		<input
			ref={input}
			type="file"
			accept={LOGO_ACCEPT}
			className="sr-only"
			tabIndex={-1}
			onChange={onChange}
		/>
	);

	return { open: () => input.current?.click(), uploading, error, fileInput };
}

export function LogoPreview({
	url,
	name,
	fallback,
}: Readonly<{ url: string | undefined; name: string; fallback: ReactNode }>) {
	return (
		<span className="inline-grid size-16 flex-none place-items-center overflow-hidden rounded-lg border bg-white">
			{url ? (
				<Image
					unoptimized
					src={url}
					alt={name}
					width={64}
					height={64}
					className="size-full object-contain p-1.5"
				/>
			) : (
				fallback
			)}
		</span>
	);
}

function uploadButtonLabel(uploading: boolean, hasLogo: boolean): string {
	if (uploading) return companyCopy.logoUploading;
	return hasLogo ? companyCopy.replaceLogo : companyCopy.uploadLogo;
}

export function LogoUploadField({
	id,
	previewUrl,
	name,
	hasLogo,
	onUploaded,
	invalid,
}: Readonly<{
	id: string;
	previewUrl: string | undefined;
	name: string;
	hasLogo: boolean;
	onUploaded: (logo: UploadedLogo) => void;
	invalid?: boolean;
}>) {
	const logo = useLogoUpload(onUploaded);
	return (
		<div className="flex items-center gap-4">
			<LogoPreview
				url={previewUrl}
				name={name}
				fallback={<span className="size-full bg-muted" />}
			/>
			<div className="flex flex-col gap-1.5">
				<Button
					id={id}
					type="button"
					variant="outline"
					size="sm"
					aria-invalid={invalid}
					disabled={logo.uploading}
					onClick={logo.open}
				>
					{uploadButtonLabel(logo.uploading, hasLogo)}
				</Button>
				<span className="text-muted-foreground text-sm">{LOGO_MESSAGES.hint}</span>
				{logo.error && <FieldError>{logo.error}</FieldError>}
			</div>
			{logo.fileInput}
		</div>
	);
}
