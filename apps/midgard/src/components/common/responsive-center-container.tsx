import { cn } from "@workspace/ui/lib/utils";

export default function ResponsiveCenterContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        className,
        "mx-6 min-w-0 max-w-5xl whitespace-normal text-balance break-words md:mx-auto md:w-5/6 lg:w-4/5 xl:w-8/14",
      )}
    >
      {children}
    </div>
  );
}
