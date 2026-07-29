import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/zypp-logo-circle.png"
      alt=""
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      draggable={false}
    />
  );
}
