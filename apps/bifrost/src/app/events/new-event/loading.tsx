import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Separator } from "@workspace/ui/components//separator";
import { Skeleton } from "@workspace/ui/components//skeleton";
import { Save, Send } from "lucide-react";

export default function NewEventLoading() {
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Arrangementer</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Opprett et arrangement</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='space-y-8'>
        {/* Title */}
        <div>
          <Skeleton className='h-4 w-12 mb-2' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-4 w-64 mt-2' />
        </div>
        <Separator />

        {/* Event metadata */}
        <div className='grid md:grid-cols-2 gap-4 grid-cols-1'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`metadata-${index + 1}`}>
              <Skeleton className='h-4 w-16 mb-2' />
              <Skeleton className='h-10 w-full' />
            </div>
          ))}
        </div>
        <Separator />

        {/* Event time and date pickers */}
        <div className='grid sm:grid-cols-2 gap-4'>
          <div>
            <Skeleton className='h-4 w-48 mb-2' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-4 w-56 mt-2' />
          </div>
          <div>
            <Skeleton className='h-4 w-52 mb-2' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-4 w-64 mt-2' />
          </div>
        </div>
        <Separator />

        {/* Teaser */}
        <div>
          <Skeleton className='h-4 w-12 mb-2' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-4 w-56 mt-2' />
        </div>

        {/* Description */}
        <div>
          <Skeleton className='h-4 w-20 mb-2' />
          <Skeleton className='h-40 w-full border rounded-md' />
          <Skeleton className='h-4 w-48 mt-2' />
        </div>
        <Separator />

        {/* Organizers */}
        <div>
          <Skeleton className='h-4 w-16 mb-2' />
          <div className='flex gap-4 mb-4'>
            <Skeleton className='h-10 w-48' />
            <Skeleton className='h-10 w-44' />
            <Skeleton className='h-10 w-32' />
          </div>
          <div className='rounded-md border'>
            <div className='p-4'>
              <Skeleton className='h-12 w-full' />
            </div>
          </div>
          <Skeleton className='h-4 w-72 mt-2' />
        </div>
        <Separator />

        {/* Event type */}
        <div>
          <Skeleton className='h-4 w-32 mb-2' />
          <Skeleton className='h-10 w-44' />
        </div>
        <Separator />

        {/* Submit buttons */}
        <div className='flex gap-4 mb-4'>
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
