"use client";

import { Button } from "@workspace/ui/components/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function MonthSelector({ months, activeMonth }: { months: string[], activeMonth: string }) {
  const router = useRouter();
  const path = usePathname();
  const searchParams = useSearchParams();

  const updateSemester = useCallback(
    (month: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("month", month);
      return params.toString();
    },
    [searchParams],
  );

  return (
    <div className='flex justify-center my-6'>
      <div className='flex gap-4 flex-wrap md:w-3/5 w-full mx-6 md:mx-0 justify-center border-b-2 border-primary'>
        {months.map((month) => (
          <Button
            type='button'
            variant='link'
            key={month}
            className={`${activeMonth === month ? 'text-primary' : 'text-zinc-400'} scroll-m-20 text-3xl font-semibold tracking-tight capitalize hover:no-underline hover:cursor-pointer hover:text-zinc-600`}
            onClick={() => router.push(`${path}?${updateSemester(month)}`)}
          >
            {month}
          </Button>
        ))}
      </div>
    </div >
  )

}
