import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Save, Send, Trash2 } from "lucide-react";

interface JobListingFormSkeletonProps {
  showDeleteButton?: boolean;
}

export default function JobListingFormSkeleton({ showDeleteButton = false }: JobListingFormSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Title field */}
        <div className='space-y-2'>
          <Skeleton className='h-4 w-12' />
          <Skeleton className='h-10 w-full' />
        </div>

        {/* Teaser field */}
        <div className='space-y-2'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-20 w-full' />
        </div>

        {/* Description field */}
        <div className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-32 w-full' />
        </div>

        {/* Company and Type row */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-12' />
            <Skeleton className='h-10 w-full' />
          </div>
        </div>

        {/* Deadline and Application URL row */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
        </div>

        {/* Contacts section */}
        <div className='space-y-4'>
          <Skeleton className='h-6 w-32' />
          <div className='space-y-4'>
            {Array.from({ length: 2 }).map(() => (
              <Card key={`job-listing-contact-skeleton-${Math.random()}`} className='p-4'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-12' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-14' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-16' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Skeleton className='h-10 w-36' />
        </div>

        {/* Action buttons */}
        <div className='flex flex-col sm:flex-row gap-2 pt-4'>
          <Button disabled className='flex-1'>
            <Send className='size-4' />
            <Skeleton className='h-4 w-20' />
          </Button>
          <Button disabled variant='outline' className='flex-1'>
            <Save className='size-4' />
            <Skeleton className='h-4 w-24' />
          </Button>
          {showDeleteButton && (
            <Button disabled variant='destructive' className='flex-1'>
              <Trash2 className='size-4' />
              <Skeleton className='h-4 w-20' />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
