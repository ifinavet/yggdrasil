import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
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
import { usePaginatedQuery, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";

export default function SelectImage({ form }: { form: UseFormReturn<CompanyFormValues> }) {
  const { results, isLoading, status, loadMore } = usePaginatedQuery(
    api.companies.getCompanyLogosPaged,
    {},
    {
      initialNumItems: 25,
    },
  );

  const formImageValue = form.getValues("image") as Id<"companyLogos">;
  const [selectedImageId, setSelectedImageId] = useState<Id<"companyLogos"> | null>(formImageValue);
  const selectedImageName = useRef<string>("");

  const selectedImage = useQuery(api.companies.getCompanyLogoById, {
    id: formImageValue || selectedImageId || undefined,
  });

  const selectImage = (imageId: Id<"companyLogos">, imageName: string) => {
    setSelectedImageId(imageId);
    selectedImageName.current = imageName;
  };

  const handleSelectedImage = useCallback(() => {
    if (selectedImageId) {
      form.setValue("image", selectedImageId);
    }
  }, [form, selectedImageId]);

  const handleCancel = useCallback(() => {
    setSelectedImageId(null);
    selectedImageName.current = form.watch("image") || "";
  }, [form]);

  return (
    <div className='flex gap-4'>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant='outline'
            className={`w-fit px-4 ${form.getValues("image") && "border-emerald-500"}`}
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
              {results.map((image) => (
                <button
                  key={image._id}
                  type='button'
                  onClick={() => selectImage(image._id, image.name)}
                  className={`m-auto flex h-24 w-24 flex-col justify-center hover:cursor-pointer ${image._id === selectedImageId ? "rounded-md outline-2 outline-primary" : ""}`}
                >
                  <img
                    src={image.imageUrl ?? ""}
                    alt={image.name}
                    width={400}
                    height={400}
                    className='justify-center object-contain p-2'
                  />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className='!justify-between w-full'>
            <Button
              variant='outline'
              onClick={() => loadMore(25)}
              disabled={status !== "CanLoadMore" || isLoading}
            >
              {isLoading ? "Laster..." : "Last inn flere bilder"}
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
        {selectedImage && (
          <Image
            src={selectedImage.imageUrl}
            alt={selectedImageName.current}
            width={400}
            height={400}
            className='h-[200px] justify-center rounded-md bg-zinc-300 object-contain p-6'
            priority
          />
        )}
      </div>
    </div>
  );
}
