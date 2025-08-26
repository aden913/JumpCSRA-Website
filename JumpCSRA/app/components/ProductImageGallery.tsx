import React, { useState } from "react";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

export type ProductImageGalleryProps = {
  images: string[];
};

export function ProductImageGallery({ images }: ProductImageGalleryProps) {
  const galleryImages = images.map(src => ({
    original: src,
    thumbnail: src,
  }));
  return <ImageGallery items={galleryImages} showPlayButton={false} showFullscreenButton={false} />;
}
