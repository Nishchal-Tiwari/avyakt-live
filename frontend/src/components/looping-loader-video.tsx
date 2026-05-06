import { useState } from "react";
import { pickRandomLoaderSrc } from "@/lib/loader-animations";
import { cn } from "@/lib/utils";

type LoopingLoaderVideoProps = {
  /** Compact clip under auth headings vs full route splash */
  variant?: "hero" | "route";
  className?: string;
  /** Accessible label for the video */
  label?: string;
  /** Fixed asset URL; omit to pick a random clip once per mount */
  src?: string;
};

export function LoopingLoaderVideo({
  variant = "hero",
  className,
  label = "Decorative meditation animation",
  src: srcProp,
}: LoopingLoaderVideoProps) {
  const [randomSrc] = useState(pickRandomLoaderSrc);
  const src = srcProp ?? randomSrc;

  return (
    <div
      className={cn(
        /* Hero: small clip above auth headings; route: splash — no chrome, just the video */
        variant === "hero" &&
          "mx-auto mb-3 h-[100px] w-[100px] sm:h-[108px] sm:w-[118px]",
        variant === "route" &&
          "h-[150px] w-[150px] sm:h-[150px] sm:w-[175px]",
        className,
      )}
    >
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="block h-full w-full object-contain object-center"
        aria-label={label}
      />
    </div>
  );
}

export function RouteLoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4">
      <LoopingLoaderVideo variant="route" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
