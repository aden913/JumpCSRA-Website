import React, { useEffect, useState } from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import type { OptionCardProps } from "./OptionsCarousel";
import "../styles/modal.css";

export type ProductDetailModalProps = {
  open: boolean;
  product: OptionCardProps | null;
  onClose: () => void;
  onPurchase?: (product: OptionCardProps) => void;
};

export function ProductDetailModal({ open, product, onClose, onPurchase }: ProductDetailModalProps) {
  const [detailImagesManifest, setDetailImagesManifest] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    if (open) {
      fetch("/assets/inflateables-detail-images.json")
        .then(res => res.json())
        .then(data => setDetailImagesManifest(data))
        .catch(() => setDetailImagesManifest({}));
    }
  }, [open]);

  if (!open || !product) return null;

  const mainImg = product.img;
  const manifestImages = detailImagesManifest[product.name] || [];
  const images = manifestImages.includes(mainImg) ? manifestImages : [mainImg, ...manifestImages];

  let wetDryLabel = "";
  if (product.wet === true && product.dry === false) wetDryLabel = "Wet Only";
  else if (product.wet === false && product.dry === true) wetDryLabel = "Dry Only";
  else if (product.wet === true && product.dry === true) wetDryLabel = "Wet and Dry";

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal-shadow" />
      <div
        className="modal-content popup"
        style={{ maxHeight: "80vh", overflowY: "auto", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="modal-title" style={{ textAlign: "center", marginBottom: "2rem" }}>{product.name}</h2>
        <div className="modal-div" style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <ProductImageGallery images={images.filter(Boolean)} />
          <div className="modal-info">
            <strong>Prices:</strong>
            <br />
            Weekday (Dry): {typeof product.weekdayPrice === "number" ? `$${product.weekdayPrice}` : "N/A"}
            <br />
            Weekend (Dry): {typeof product.weekendPrice === "number" ? `$${product.weekendPrice}` : "N/A"}
            <br />
            Weekday (Wet): {typeof product.weekdayWaterPrice === "number" ? `$${product.weekdayWaterPrice}` : "N/A"}
            <br />
            Weekend (Wet): {typeof product.weekendWaterPrice === "number" ? `$${product.weekendWaterPrice}` : "N/A"}
            <br />
            <strong>Dimensions:</strong> {product.dimensions || "N/A"}
            <br />
            {wetDryLabel && <div className="wetdry-box">{wetDryLabel}</div>}
            <br />
            <strong>Description:</strong> {product.description || "No description yet."}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
          <button className="modal-purchase" onClick={() => onPurchase && product && onPurchase(product)}>
            Add to Cart
          </button>
          <button className="modal-close" onClick={onClose}>
            X
          </button>
        </div>
      </div>
    </div>
  );
}
