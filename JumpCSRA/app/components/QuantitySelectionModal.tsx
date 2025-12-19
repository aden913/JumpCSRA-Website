import React from "react";
import "../styles/modal.css";

interface QuantitySelectionModalProps {
  open: boolean;
  product: any;
  selectedQuantity: number;
  setSelectedQuantity: (quantity: number) => void;
  availableQuantity: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function QuantitySelectionModal({ 
  open, 
  product, 
  selectedQuantity,
  setSelectedQuantity,
  availableQuantity,
  onConfirm, 
  onClose 
}: QuantitySelectionModalProps) {
  if (!open || !product) return null;

  const quantityOptions = Array.from({ length: availableQuantity }, (_, i) => i + 1);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
      <div className="modal-shadow" />
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Quantity</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <img 
              src={product.img || product.image} 
              alt={product.name}
              style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px" }}
            />
            <h4 style={{ margin: "1rem 0 0.5rem 0" }}>{product.name}</h4>
            <p style={{ margin: "0", color: "#666" }}>
              ${typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0} each
            </p>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              Quantity (up to {availableQuantity} available):
            </label>
            <select
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "1rem"
              }}
            >
              {quantityOptions.map(qty => (
                <option key={qty} value={qty}>{qty}</option>
              ))}
            </select>
          </div>

          <div style={{ 
            marginBottom: "1.5rem", 
            padding: "1rem", 
            backgroundColor: "#f8f9fa", 
            borderRadius: "8px" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: "bold" }}>
                ${((typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0) * selectedQuantity).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="modal-purchase"
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            Add {selectedQuantity} to Cart
          </button>
        </div>
      </div>
    </div>
  );
}