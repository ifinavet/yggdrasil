"use client";

import { Button } from "@workspace/ui/components/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function MonthSelector({
	months,
	activeMonth,
}: {
	months: string[];
	activeMonth: string;
}) {
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
		<div className='my-6 flex justify-center'>
			<div className='mx-6 flex w-full flex-wrap justify-center gap-4 border-primary border-b-2 md:mx-0 md:w-3/5 dark:border-primary-foreground'>
				{months.map((month) => (
					<Button
						type='button'
						variant='link'
						key={month}
						className={`${activeMonth === month ? "dark:text-primary-foreground" : "text-zinc-400 dark:text-gray-500"} scroll-m-20 font-semibold text-3xl capitalize tracking-tight hover:cursor-pointer hover:text-zinc-600 hover:no-underline`}
						onClick={() => router.push(`${path}?${updateSemester(month)}`)}
					>
						{month}
					</Button>
				))}
			</div>
		</div>
	);
}
