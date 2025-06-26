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

  const { data: images,
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
            <div className='grid flex-1 grid-cols-4 max-h-96 gap-4 items-center bg-zinc-300 p-4 rounded-md overflow-scroll'>
              {images?.pages.map((page, i) => (
                <React.Fragment key={`page-${i + 1}`}>
                  {page.data.map(image => {
                    const { data } = supabase.storage
                      .from("companies")
                      .getPublicUrl(`company_images/${image.name}`);
                    return (
                      <button
                        key={image.id}
                        type='button'
                        onClick={() => selectImage(image.id, image.name)}
                        className={`flex flex-col justify-center hover:cursor-pointer h-24 w-24 m-auto ${image.id === selectedImageId ? "outline-2 outline-primary rounded-md" : ""}`}
                      >
                        <Image
                          src={data.publicUrl}
                          alt={image.name}
                          width={400}
                          height={400}
                          className='justify-center p-2 object-contain'
                        />
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <DialogFooter className='w-full !justify-between'>
            <Button variant="outline"
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetching}
            >
              {isFetchingNextPage
                ? 'Last inn flere...'
                : hasNextPage
                  ? 'Last inn flere'
                  : 'Ingen flere bilder'}
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
      <div className='h-[200px] mb-1 over'>
        {selectedImageUrl && (
          <Image
            src={selectedImageUrl.data.publicUrl}
            alt={selectedImageName.current}
            width={400}
            height={400}
            className='justify-center p-6 object-contain bg-zinc-300 rounded-md h-[200px]'
          />
        )}
      </div>
    </div>
  );
}
