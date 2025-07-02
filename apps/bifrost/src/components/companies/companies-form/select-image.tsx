import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components//button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components//dialog";
import { Check, X } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import getAllCompanyImages from "@/lib/queries/companies/getAllImages";
import { createClient } from "@/lib/supabase/client";

export default function SelectImage({ form }: { form: UseFormReturn<CompanyFormValues> }) {
	const supabase = createClient();

	const [selectedImageId, setSelectedImageId] = useState("");
	const selectedImageName = useRef(form.watch("company_image.name"));
	const selectedImageUrl =
		form.watch("company_image.name") !== ""
			? supabase.storage.from("companies").getPublicUrl(form.watch("company_image.name"))
			: null;

	const {
		data: images,
		fetchNextPage,
		hasNextPage,
		isFetching,
		isFetchingNextPage,
	} = useInfiniteQuery({
		queryKey: ["company_images"],
		queryFn: getAllCompanyImages,
		initialPageParam: 0,
		getNextPageParam: (lastPage) => lastPage.nextPage,
	});

	const selectImage = (imageId: string, imageName: string) => {
		setSelectedImageId(imageId);
		selectedImageName.current = `company_images/${imageName}`;
	};

	const handleSelectedImage = useCallback(() => {
		form.setValue("company_image", { id: selectedImageId, name: selectedImageName.current });
	}, [form, selectedImageId]);

	const handleCancel = useCallback(() => {
		setSelectedImageId("");
		selectedImageName.current = form.watch("company_image.name");
	}, [form]);

	return (
		<div className='flex gap-4'>
			<Dialog>
				<DialogTrigger asChild>
					<Button
						variant='outline'
						className={`w-fit px-4 ${form.getValues("company_image") && "border-emerald-500"}`}
					>
						Velg et bilde
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Velg et bilde</DialogTitle>
						<DialogDescription>Velg et bilde som skal vises på nettsiden.</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col'>
						<div className='grid max-h-96 flex-1 grid-cols-4 items-center gap-4 overflow-scroll rounded-md bg-zinc-300 p-4'>
							{images?.pages.map((page, i) => (
								<React.Fragment key={`page-${i + 1}`}>
									{page.data.map((image) => {
										const { data } = supabase.storage
											.from("companies")
											.getPublicUrl(`company_images/${image.name}`);
										return (
											<button
												key={image.id}
												type='button'
												onClick={() => selectImage(image.id, image.name)}
												className={`m-auto flex h-24 w-24 flex-col justify-center hover:cursor-pointer ${image.id === selectedImageId ? "rounded-md outline-2 outline-primary" : ""}`}
											>
												<Image
													src={data.publicUrl}
													alt={image.name}
													width={400}
													height={400}
													className='justify-center object-contain p-2'
												/>
											</button>
										);
									})}
								</React.Fragment>
							))}
						</div>
					</div>
					<DialogFooter className='!justify-between w-full'>
						<Button
							variant='outline'
							onClick={() => fetchNextPage()}
							disabled={!hasNextPage || isFetching}
						>
							{isFetchingNextPage
								? "Last inn flere..."
								: hasNextPage
									? "Last inn flere"
									: "Ingen flere bilder"}
						</Button>

						<div className='flex gap-4'>
							<DialogClose asChild>
								<Button type='button' variant='default' onClick={handleSelectedImage}>
									<Check /> Bekreft
								</Button>
							</DialogClose>
							<DialogClose asChild>
								<Button type='button' variant='secondary' onClick={handleCancel}>
									<X /> Avbryt
								</Button>
							</DialogClose>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<div className='over mb-1 h-[200px]'>
				{selectedImageUrl && (
					<Image
						src={selectedImageUrl.data.publicUrl}
						alt={selectedImageName.current}
						width={400}
						height={400}
						className='h-[200px] justify-center rounded-md bg-zinc-300 object-contain p-6'
					/>
				)}
			</div>
		</div>
	);
}
