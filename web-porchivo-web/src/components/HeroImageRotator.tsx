import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RotatorImage {
  src: string;
  alt: string;
}

interface HeroImageRotatorProps {
  images: RotatorImage[];
  interval?: number;
  durations?: number[];
}

export default function HeroImageRotator({
  images,
  interval = 5000,
  durations,
}: HeroImageRotatorProps) {
  const [index, setIndex] = useState<number>(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const duration = durations?.[index] ?? interval;

    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [index, images.length, interval, durations]);

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-[2.5rem] bg-white">
      {images.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out",
            i === index ? "opacity-100" : "opacity-0"
          )}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}
    </div>
  );
}
