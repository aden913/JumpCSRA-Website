import React, { useState, useEffect } from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import type { OptionCardProps } from "./OptionsCarousel";
import { useModalScrollLock } from "../hooks/useModalScrollLock";
import "../styles/modal.css";

export type ProductDetailModalProps = {
  open: boolean;
  product: OptionCardProps | null;
  onClose: () => void;
  onPurchase?: (product: OptionCardProps, quantity?: number) => void;
};

export function ProductDetailModal({ 
  open, 
  product, 
  onClose, 
  onPurchase
}: ProductDetailModalProps) {
  // Prevent background scrolling when modal is open
  useModalScrollLock(open);
  
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const selectedProductIsGiftCard = product?.category === 'gift-card' || product?.isGiftCard || product?.name?.toLowerCase().includes('gift card');
  
  // Reset quantity when modal opens/closes or product changes
  useEffect(() => {
    setSelectedQuantity(selectedProductIsGiftCard ? 50 : 1);
  }, [open, product, selectedProductIsGiftCard]);

  if (!open || !product) return null;

  const isGiftCard = selectedProductIsGiftCard;
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
        className="modal-content popup product-detail-modal"
        style={{ maxHeight: "80vh", overflowY: "auto", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="modal-title" style={{ textAlign: "center", marginBottom: "2rem" }}>{product.name}</h2>
        <div className="modal-div product-detail-layout">
          <div className="product-detail-gallery">
            <ProductImageGallery images={images.filter(Boolean)} />
          </div>
          <div className="modal-info">
            <strong>Description:</strong> {product.description || "No description yet."}
            <br />
            <br />
            <strong>Dimensions:</strong> {product.dimensions || "N/A"}
            
            {isGiftCard && (
              <>
                <br />
                <br />
                <div style={{ marginTop: '1rem' }}>
                  <strong>Gift Card Value:</strong>
                  <select 
                    value={selectedQuantity} 
                    onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                    style={{ 
                      marginLeft: '10px', 
                      padding: '5px 10px', 
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                  >
                    <option value={50}>$50</option>
                    <option value={100}>$100</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <button
            className="modal-purchase"
            type="button"
            onClick={() => {
              if (onPurchase && product) {
                const purchaseQuantity = isGiftCard ? selectedQuantity : 1;
                onPurchase({
                  ...product,
                  wetDry: wetDryLabel,
                  category: product.category || ""
                }, purchaseQuantity);
              }
            }}
          >
            {isGiftCard ? `Add $${selectedQuantity} Gift Card` : 'Add to Cart'
            }
          </button>
        </div>
        <button className="modal-close" onClick={onClose}>
          X
        </button>
      </div>
    </div>
  );
}
