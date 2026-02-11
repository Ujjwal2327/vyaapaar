import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * LazyAvatar Component
 * Implements lazy loading for contact photos to improve performance
 * Only loads images when they come into viewport
 */
export const LazyAvatar = ({
  src,
  alt,
  fallback,
  className = "",
  threshold = 0.1, // Load when 10% visible
  rootMargin = "50px", // Start loading 50px before entering viewport
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Only set up IntersectionObserver if we have a src
    if (!src) {
      setImageSrc(null);
      return;
    }

    // If IntersectionObserver is not supported, load immediately
    if (!('IntersectionObserver' in window)) {
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true);
            setImageSrc(src);
            // Once loaded, we can disconnect
            if (imgRef.current) {
              observer.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, threshold, rootMargin, isInView]);

  return (
    <Avatar ref={imgRef} className={className} {...props}>
      <AvatarImage
        src={imageSrc || undefined}
        alt={alt}
        loading="lazy" // Native lazy loading as additional optimization
      />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
};

/**
 * Hook for preloading images in batches
 * Useful for preloading visible contacts when scrolling
 */
export const useImagePreload = (imageUrls = [], batchSize = 5) => {
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [currentBatch, setCurrentBatch] = useState(0);

  useEffect(() => {
    if (!imageUrls.length) return;

    const startIdx = currentBatch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, imageUrls.length);
    const batch = imageUrls.slice(startIdx, endIdx);

    // Preload batch
    batch.forEach((url) => {
      if (!url || loadedImages.has(url)) return;

      const img = new Image();
      img.src = url;
      img.onload = () => {
        setLoadedImages((prev) => new Set([...prev, url]));
      };
      img.onerror = () => {
        console.warn(`Failed to preload image: ${url}`);
      };
    });
  }, [imageUrls, currentBatch, batchSize]);

  const loadNextBatch = () => {
    setCurrentBatch((prev) => prev + 1);
  };

  return {
    loadedImages,
    loadNextBatch,
    hasMore: (currentBatch + 1) * batchSize < imageUrls.length,
  };
};