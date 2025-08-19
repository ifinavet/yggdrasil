import type { Doc } from "@workspace/backend/convex/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Pencil } from "lucide-react";
import Link from "next/link";

export default function ResourceCard({ resource }: Readonly<{ resource: Doc<"resources"> }>) {
  return (
    <Link href={`/resources/${resource._id}`} key={resource._id}>
      <Card
        key={resource._id}
        className='overflow-hidden border-0 py-0 pb-6 shadow-sm transition-shadow hover:shadow-md'
      >
        <div className='relative h-28 bg-gradient-to-r from-sky-400 to-blue-800'>
          <div className='-bottom-4 absolute left-6'>
            <div className='flex size-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg dark:bg-gray-200'>
              <Pencil className='size-6 text-white dark:text-black' />
            </div>
          </div>
        </div>
        <CardHeader className='pt-6'>
          <CardTitle className='font-semibold text-accent-foreground text-xl'>
            {resource.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className='text-primary leading-relaxed'>
            {resource.excerpt}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
