import React from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import type { OptionCardProps } from "./OptionsCarousel";
import { useModalScrollLock } from "../hooks/useModalScrollLock";
import "../styles/modal.css";

export type ProductDetailModalProps = {
  open: boolean;
  product: OptionCardProps | null;
  onClose: () => void;
  onPurchase?: (product: OptionCardProps) => void;
};

export function ProductDetailModal({ open, product, onClose, onPurchase }: ProductDetailModalProps) {
  // Prevent background scrolling when modal is open
  useModalScrollLock(open);

  if (!open || !product) return null;

  const mainImg = product.img;
  const detailImages = product.detailImages || [];
  const images = detailImages.includes(mainImg) ? detailImages : [mainImg, ...detailImages];

  let wetDryLabel = "";
  if (product.wet === true && product.dry === false) wetDryLabel = "Wet";
  else if (product.wet === false && product.dry === true) wetDryLabel = "Dry";
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
                        <strong>Description:</strong> {product.description || "No description yet."}

            <br />
            <br />
            <strong>Dimensions:</strong> {product.dimensions || "N/A"}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
          <button
            className="modal-purchase"
            onClick={() => {
              if (onPurchase && product) {
                onPurchase({
                  ...product,
                  wetDry: wetDryLabel,
                  category: product.category || ""
                });
              }
            }}
          >
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
