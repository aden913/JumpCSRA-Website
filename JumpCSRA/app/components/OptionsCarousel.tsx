import React, { useLayoutEffect, useState, useRef, useEffect } from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from 'swiper/modules';
import { getDatabase, ref, onValue } from "firebase/database";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./FirebaseConfig";


import "swiper/css";
import "swiper/css/navigation";
import "../styles/options.css";

export type OptionCardProps = {
  name: string;
  img: string;
  price?: string;
  description?: string;
  dimensions?: string;
  wet?: string;
  onOrder?: (product: OptionCardProps) => void;
};

function OptionCard({ name, img, price, description, dimensions, wet, onOrder }: OptionCardProps) {
  // Dynamically scale font size if name is too long
  let fontSize = "1.2rem";
  if (name.length > 18) fontSize = "1rem";
  if (name.length > 28) fontSize = ".85rem";

  let wetDryLabel = "";
  if (wet === "Y") wetDryLabel = "Wet Only";
  else if (wet === "N") wetDryLabel = "Dry Only";
  else if (wet && wet.toLowerCase() === "both") wetDryLabel = "Wet & Dry";

  return (
    <div className="option-card">
      <div className="option-title marquee-container" style={{ fontSize }}>
        <span>{name}</span>
      </div>
      <img src={img} draggable="false" alt={name} className="option-img" />
      {wetDryLabel && (
        <div className="wetdry-box">{wetDryLabel}</div>
      )}
      <button className="order-btn" onClick={() => onOrder && onOrder({ name, img, price, description, dimensions, wet })}>ORDER NOW</button>
    </div>
  );
}

export type OptionsCarouselProps = {
  options: OptionCardProps[];
};

// Helper to get product images (main + extra)
function getProductImages(product: OptionCardProps): string[] {
  if (!product) {
    return [];
  }
  const images: string[] = [];
  if (product.img) {
    images.push(product.img);
  }
  // Add up to 5 detail images
  const baseName = product.name.replace(/ /g, '-').toLowerCase();
  const folderName = product.name;
  for (let i = 1; i <= 5; i++) {
    images.push(`/assets/inflateables/detail-images/${folderName}/${baseName}-${i}.png`);
  }
  return images;
}

export function OptionsCarousel({ options }: OptionsCarouselProps) {
  // Firebase setup
  const [inflateables, setInflateables] = useState<OptionCardProps[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OptionCardProps | null>(null);

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const inflateablesRef = ref(db, "inflateables");
    onValue(inflateablesRef, (snapshot) => {
      const data = snapshot.val();
      if (Array.isArray(data)) {
        setInflateables(data);
      } else if (typeof data === "object" && data !== null) {
        setInflateables(Object.values(data));
      }
    });
  }, []);

  const handleOrderNow = (product: OptionCardProps) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  return (
    <>
      <Swiper
        modules={[Navigation]}
        slidesPerView={3}
        spaceBetween={1}
        navigation={true}
        breakpoints={{
          1024: { slidesPerView: 3 },
          464: { slidesPerView: 2 },
          0: { slidesPerView: 1 }
        }}
        style={{ padding: ".5rem 0" }}
      >
        {inflateables.map((opt: OptionCardProps) => (
          <SwiperSlide key={opt.name}>
            <OptionCard {...opt} onOrder={handleOrderNow} />
          </SwiperSlide>
        ))}
      </Swiper>
      {modalOpen && selectedProduct && (
        <div className="modal-overlay fade-in" onClick={() => setModalOpen(false)}>
          <div className="modal-shadow" />
          <div className="modal-content popup" style={{ maxHeight: "80vh", overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ width: "100%", textAlign: "center", marginBottom: "2rem" }}>{selectedProduct.name}</h2>
            <div style={{ display: "flex", flexDirection: "row", width: "100%", gap: "2rem" }}>
              <div style={{ flex: "1 1 55%", width: "45%" }}>
                <ProductImageGallery images={getProductImages(selectedProduct)} />
              </div>
              <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", justifyContent: "flex-start", width: "45%" }}>
                {selectedProduct.description && (
                  <div style={{ marginBottom: "2rem" }}>{selectedProduct.description}</div>
                )}
                <div style={{ marginBottom: "2rem" }}>
                  <strong>Price:</strong> {selectedProduct.price || "N/A"}<br />
                  <strong>Dimensions:</strong> {selectedProduct.dimensions || "N/A"}<br />
                  <strong>Wet/Dry:</strong> {selectedProduct.wet === "Y" ? "Wet Only" : selectedProduct.wet === "N" ? "Dry Only" : selectedProduct.wet ? selectedProduct.wet : "N/A"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "2rem" }}>
              <button className="modal-close" onClick={() => setModalOpen(false)}>Close</button>
              <button className="modal-addcart">Add To Cart</button>
            </div>
          </div>
        </div>
      )}
{/* // Helper to get product images (main + extra)
function getProductImages(product: OptionCardProps): string[] {
  // You can extend this to pull extra images from a DB or static mapping
  // For now, just return the main image
  if (!product) return [];
  // Example: if you have extra images, add them here
  // e.g. return [product.img, ...extraImages[product.name] || []]
  return product.img ? [product.img] : [];
} */}
    </>
  );
}

