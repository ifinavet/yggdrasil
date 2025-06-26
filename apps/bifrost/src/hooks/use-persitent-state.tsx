"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

type SetStateAction<T> = T | ((prevState: T) => T);

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, (value: SetStateAction<T>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get current value from URL or use initial value
  const state = useMemo(() => {
    const paramValue = searchParams.get(key);

    if (paramValue === null) {
      return initialValue;
    }

    try {
      // Try to parse as JSON for complex types
      return JSON.parse(decodeURIComponent(paramValue));
    } catch {
      // If JSON parsing fails, return as string (for primitive strings)
      return decodeURIComponent(paramValue) as T;
    }
  }, [searchParams, key, initialValue]);

  // Set state function
  const setState = useCallback(
    (value: SetStateAction<T>) => {
      const newValue = typeof value === "function" ? (value as (prevState: T) => T)(state) : value;

      const params = new URLSearchParams(searchParams.toString());

      if (
        newValue === initialValue ||
        newValue === null || newValue === undefined ||
        newValue === ""
      ) {
        // Remove param if it matches initial value or is empty
        params.delete(key);
      } else {
        // Serialize the value
        const serializedValue =
          typeof newValue === "string"
            ? encodeURIComponent(newValue)
            : encodeURIComponent(JSON.stringify(newValue));

        params.set(key, serializedValue);
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

      router.replace(newUrl, { scroll: false });
    },
    [searchParams, router, pathname, key, initialValue, state],
  );

  return [state, setState];
}
