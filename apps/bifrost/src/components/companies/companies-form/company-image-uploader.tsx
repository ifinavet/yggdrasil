"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { Send, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

const schema = z.object({
	image: z.file().mime(["image/jpeg", "image/svg+xml", "image/webp", "image/png"]),
	name: z.string().min(1, "Navn er påkrevd"),
});

export default function CompanyImageUploader({
	onImageUploadedAction,
	onDismissAction,
}: {
	onImageUploadedAction: (imageId: Id<"companyLogos">, imageName: string) => void;
	onDismissAction: () => void;
}) {
	const form = useForm<z.infer<typeof schema>>({
		resolver: zodV4Resolver(schema),
		defaultValues: {
			image: undefined,
			name: "",
		},
	});

	const generateUploadUrl = useMutation(api.companies.generateUploadUrl);
	const storeCompanyImage = useMutation(api.companies.uploadCompanyLogo);
	const uploadImage = async (value: z.Infer<typeof schema>) => {
		console.log("Upload image called with:", value);

		try {
			const url = await generateUploadUrl();

			const result = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": value.image.type },
				body: value.image,
			});

			const { storageId } = await result.json();

			const logoId = await storeCompanyImage({
				id: storageId,
				name: value.name,
			});

			form.reset();
			toast.success("Bilde lastet opp og lagret!");

			if (onImageUploadedAction && logoId) {
				onImageUploadedAction(logoId, value.name);
			}
		} catch (error) {
			console.error("Error uploading image:", error);
			toast.error("Noe gikk galt under opplastingen av bildet. Vennligst prøv igjen.");
		}
	};

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		console.log("Form submit intercepted");
		e.preventDefault();
		e.stopPropagation();
		form.handleSubmit(uploadImage)(e);
	};

	return (
		<Form {...form}>
			<form className='space-y-8' onSubmit={handleFormSubmit}>
				<FormField
					control={form.control}
					name='image'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Velg bilde som skal lastes opp.</FormLabel>
							<Input
								type='file'
								name={field.name}
								ref={field.ref}
								onBlur={field.onBlur}
								disabled={field.disabled}
								onChange={(event) => {
									const file = event.target.files?.[0];
									field.onChange(file);
								}}
							/>
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name='name'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Navn på bildet</FormLabel>
							<Input type='text' placeholder='Skriv inn navnet på selskapet' {...field} />
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className='flex gap-4'>
					<Button type='submit' disabled={form.formState.isSubmitting}>
						<Send />
						{form.formState.isSubmitting ? "Laster opp..." : "Last opp"}
					</Button>
					<Button
						type='button'
						variant='outline'
						onClick={onDismissAction}
						disabled={form.formState.isSubmitting}
					>
						<X />
						Avbryt
					</Button>
				</div>
			</form>
		</Form>
	);
}
