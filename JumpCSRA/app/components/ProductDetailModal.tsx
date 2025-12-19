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
  // Party essentials availability props
  getQuantityOptions?: (itemName: string) => number[];
  getAvailableQuantityForItem?: (itemName: string) => number;
  itemAvailability?: Map<string, any>;
  hasValidDates?: boolean;
};

export function ProductDetailModal({ 
  open, 
  product, 
  onClose, 
  onPurchase,
  getQuantityOptions,
  getAvailableQuantityForItem,
  itemAvailability,
  hasValidDates 
}: ProductDetailModalProps) {
  // Prevent background scrolling when modal is open
  useModalScrollLock(open);
  
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  
  // Reset quantity when modal opens/closes or product changes
  useEffect(() => {
    setSelectedQuantity(1);
  }, [open, product]);

  if (!open || !product) return null;

  const isPartyEssential = product.category === 'party-essentials';
  const quantityOptions = isPartyEssential && getQuantityOptions ? getQuantityOptions(product.name) : [];
  const availableQuantity = isPartyEssential && getAvailableQuantityForItem ? getAvailableQuantityForItem(product.name) : 0;
  const availability = isPartyEssential && itemAvailability ? itemAvailability.get(product.name) : null;

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
            
            {isPartyEssential && (
              <>
                <br />
                <br />
                <div className="availability-section">
                  <strong>Availability:</strong>
                  {!hasValidDates ? (
                    <span style={{ color: '#666' }}> Please select event dates to check availability</span>
                  ) : availability?.isAvailable === false ? (
                    <span style={{ color: 'red' }}> Not available for selected dates</span>
                  ) : availableQuantity > 0 ? (
                    <span style={{ color: 'green' }}> {availableQuantity} available</span>
                  ) : (
                    <span style={{ color: 'orange' }}> Checking availability...</span>
                  )}
                </div>
                
                {hasValidDates && availableQuantity > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Quantity:</strong>
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
                      {quantityOptions.map(qty => (
                        <option key={qty} value={qty}>{qty}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
          <button
            className="modal-purchase"
            onClick={() => {
              if (onPurchase && product) {
                const quantity = isPartyEssential ? selectedQuantity : 1;
                onPurchase({
                  ...product,
                  wetDry: wetDryLabel,
                  category: product.category || ""
                }, quantity);
              }
            }}
            disabled={isPartyEssential && (!hasValidDates || availableQuantity <= 0)}
            style={isPartyEssential && (!hasValidDates || availableQuantity <= 0) ? 
              { backgroundColor: "#ccc", cursor: "not-allowed" } : {}
            }
          >
            {isPartyEssential && selectedQuantity > 1 ? 
              `Add ${selectedQuantity} to Cart` : 
              'Add to Cart'
            }
          </button>
          <button className="modal-close" onClick={onClose}>
            X
          </button>
        </div>
      </div>
    </div>
  );
}
