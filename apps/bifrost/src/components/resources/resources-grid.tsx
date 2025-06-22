import { auth } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components//card";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { getAllResources } from "@/lib/queries/resources";

export default async function ResourcesGrid() {
  const resources = await getAllResources();
  const { orgRole } = await auth();

  return (
    <div className='flex flex-col gap-4 mx-4'>
      {Object.entries(resources.groupedResources).map(([tag, resources]) => (
        <div key={tag} className='flex flex-col gap-4'>
          <h4 className='scroll-m-20 text-xl font-semibold tracking-tight capitalize'>{tag}</h4>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl'>
            {resources.map((resource) => (
              <Link href={`/resources/${resource.resource_id}`} key={resource.resource_id}>
                <Card
                  key={resource.resource_id}
                  className='overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow py-0 pb-6'
                >
                  <div className='h-28 bg-gradient-to-r from-sky-400 to-blue-800 relative'>
                    <div className='absolute -bottom-4 left-6'>
                      <div className='size-12 bg-gray-600 dark:bg-gray-200 rounded-xl flex items-center justify-center shadow-lg'>
                        <Pencil className='size-6 text-white dark:text-black' />
                      </div>
                    </div>
                  </div>
                  <CardHeader className='pt-6'>
                    <CardTitle className='text-xl font-semibold text-accent-foreground'>
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
            ))}
          </div>
        </div>
      ))}

      {resources.unpublishedResources.length > 0 &&
        (orgRole === "org:admin" || orgRole === "org:editor") && (
          <div className='flex flex-col gap-4'>
            <h4 className='scroll-m-20 text-xl font-semibold tracking-tight'>
              Upubliserte ressurser
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl'>
              {resources.unpublishedResources.map((resource) => (
                <Link href={`/resources/${resource.resource_id}/edit`} key={resource.resource_id}>
                  <Card
                    key={resource.resource_id}
                    className='overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow py-0 pb-6'
                  >
                    <div className='h-28 bg-gradient-to-r from-sky-400 to-blue-800 relative'>
                      <div className='absolute -bottom-4 left-6'>
                        <div className='w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg'>
                          <Pencil className='w-6 h-6 text-white' />
                        </div>
                      </div>
                    </div>
                    <CardHeader className='pt-8 pb-2'>
                      <CardTitle className='text-xl font-semibold text-gray-900'>
                        {resource.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className='text-gray-600 leading-relaxed'>
                        {resource.excerpt}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
