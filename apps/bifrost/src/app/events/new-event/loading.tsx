import { Button } from "@workspace/ui/components//button";
import { Separator } from "@workspace/ui/components//separator";
import { Skeleton } from "@workspace/ui/components//skeleton";
import { Save, Send } from "lucide-react";

export default function NewEventLoading() {
  return (
    <>
      <div className='space-y-8'>
        {/* Title */}
        <div>
          <Skeleton className='mb-2 h-4 w-12' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='mt-2 h-4 w-64' />
        </div>
        <Separator />

        {/* Event metadata */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`metadata-${index + 1}`}>
              <Skeleton className='mb-2 h-4 w-16' />
              <Skeleton className='h-10 w-full' />
            </div>
          ))}
        </div>
        <Separator />

        {/* Event time and date pickers */}
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Skeleton className='mb-2 h-4 w-48' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='mt-2 h-4 w-56' />
          </div>
          <div>
            <Skeleton className='mb-2 h-4 w-52' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='mt-2 h-4 w-64' />
          </div>
        </div>
        <Separator />

        {/* Teaser */}
        <div>
          <Skeleton className='mb-2 h-4 w-12' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='mt-2 h-4 w-56' />
        </div>

        {/* Description */}
        <div>
          <Skeleton className='mb-2 h-4 w-20' />
          <Skeleton className='h-40 w-full rounded-md border' />
          <Skeleton className='mt-2 h-4 w-48' />
        </div>
        <Separator />

        {/* Organizers */}
        <div>
          <Skeleton className='mb-2 h-4 w-16' />
          <div className='mb-4 flex gap-4'>
            <Skeleton className='h-10 w-48' />
            <Skeleton className='h-10 w-44' />
            <Skeleton className='h-10 w-32' />
          </div>
          <div className='rounded-md border'>
            <div className='p-4'>
              <Skeleton className='h-12 w-full' />
            </div>
          </div>
          <Skeleton className='mt-2 h-4 w-72' />
        </div>
        <Separator />

        {/* Event type */}
        <div>
          <Skeleton className='mb-2 h-4 w-32' />
          <Skeleton className='h-10 w-44' />
        </div>
        <Separator />

        {/* Submit buttons */}
        <div className='mb-4 flex gap-4'>
          <Button disabled>
            <Send /> Lagre og publiser
          </Button>
          <Button variant='secondary' disabled>
            <Save /> Lagre
          </Button>
        </div>
      </div>
    </>
  );
}
