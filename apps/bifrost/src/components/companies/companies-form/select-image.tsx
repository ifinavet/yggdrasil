import { useQuery } from "@tanstack/react-query";
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
import { useCallback, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import getAllCompanyImages from "@/lib/queries/companies/getAllImages";
import { createClient } from "@/utils/supabase/client";

export default function SelectImage({ form }: { form: UseFormReturn<CompanyFormValues> }) {
  const supabase = createClient();

  const offset = useRef(0);
  const [selectedImageId, setSelectedImageId] = useState("");

  const { data: images } = useQuery({
    queryKey: ["company_images", offset.current],
    queryFn: () => getAllCompanyImages(offset.current),
  });

  const selectImage = (imageId: string) => {
    setSelectedImageId(imageId);
    console.log("Selected image ID:", selectedImageId);
  };

  const handleSelectedImage = useCallback(() => {
    form.setValue("company_image", selectedImageId);
  }, [form, selectedImageId]);

  return (
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
          <div className='grid flex-1 grid-cols-4 gap-4 items-center'>
            {images?.map((image) => {
              const { data } = supabase.storage
                .from("companies")
                .getPublicUrl(`company_images/${image.name}`);
              return (
                <button
                  key={image.id}
                  type='button'
                  onClick={() => selectImage(image.id)}
                  className={`hover:cursor-pointer h-24 w-24 m-auto flex ${image.id === selectedImageId ? "outline-2 outline-primary rounded-md" : ""}`}
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
          </div>
        </div>
        <DialogFooter className='w-full justify-center! sm:justify-start'>
          <div className='flex flex-col justify-center gap-4 sm:justify-between'>
            <DialogClose asChild>
              <Button type='button' variant='default' onClick={handleSelectedImage}>
                <Check /> Bekreft
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type='button' variant='secondary'>
                <X /> Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
