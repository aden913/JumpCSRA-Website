import React, { useLayoutEffect, useState, useRef, useEffect } from "react";
import { useCallback } from "react";
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
  wet?: boolean;
  dry?: boolean;
  weekdayPrice?: number;
  weekendPrice?: number;
  weekdayWaterPrice?: number;
  weekendWaterPrice?: number;
  onOrder?: (product: OptionCardProps) => void;
};

function OptionCard({ name, img, price, description, dimensions, wet, dry, weekdayPrice, weekendPrice, weekdayWaterPrice, weekendWaterPrice, onOrder }: OptionCardProps) {
  // Dynamically scale font size if name is too long
  let fontSize = "1.2rem";
  if (name.length > 18) fontSize = "1rem";
  if (name.length > 28) fontSize = ".85rem";

  let wetDryLabel = "";
  if (wet === true && dry === false) wetDryLabel = "Wet Only";
  else if (wet === false && dry === true) wetDryLabel = "Dry Only";
  else if (wet === true && dry === true) wetDryLabel = "Wet and Dry";

  return (
    <div className="option-card">
      <div className="option-title marquee-container" style={{ fontSize }}>
        <span>{name}</span>
      </div>
      <img src={img} draggable="false" alt={name} className="option-img" />
      {wetDryLabel && (
        <div className="wetdry-box">{wetDryLabel}</div>
      )}
  <button className="order-btn" onClick={() => onOrder && onOrder({ name, img, price, description, dimensions, wet, dry, weekdayPrice, weekendPrice, weekdayWaterPrice, weekendWaterPrice})}>ORDER NOW</button>
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
  const [detailImagesManifest, setDetailImagesManifest] = useState<{ [key: string]: string[] }>({});

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

  // Fetch manifest when modal opens for the first time
  useEffect(() => {
    if (modalOpen && Object.keys(detailImagesManifest).length === 0) {
      fetch("/assets/inflateables-detail-images.json")
        .then(res => res.json())
        .then(data => setDetailImagesManifest(data))
        .catch(() => setDetailImagesManifest({}));
    }
  }, [modalOpen, detailImagesManifest]);

  // Helper to get product images using manifest
  const getProductImages = useCallback((product: OptionCardProps): string[] => {
    if (!product) return [];
    const manifestImages = detailImagesManifest[product.name] || [];
    // Always include main image first if not already in manifest
    const mainImg = product.img && !manifestImages.includes(product.img) ? [product.img] : [];
    return [...mainImg, ...manifestImages];
  }, [detailImagesManifest]);

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
                  <strong>Prices:</strong><br />
                  <span>Weekday (Dry): </span>{(typeof selectedProduct.weekdayPrice === "number") ? `$${selectedProduct.weekdayPrice}` : "N/A"}<br />
                  <span>Weekend (Dry): </span>{(typeof selectedProduct.weekendPrice === "number") ? `$${selectedProduct.weekendPrice}` : "N/A"}<br />
                  <span>Weekday (Wet): </span>{(typeof selectedProduct.weekdayWaterPrice === "number") ? `$${selectedProduct.weekdayWaterPrice}` : "N/A"}<br />
                  <span>Weekend (Wet): </span>{(typeof selectedProduct.weekendWaterPrice === "number") ? `$${selectedProduct.weekendWaterPrice}` : "N/A"}<br />
                  <strong>Dimensions:</strong> {selectedProduct.dimensions || "N/A"}<br />
                  <strong>Wet/Dry:</strong> {
                    selectedProduct.wet === true && selectedProduct.dry === true
                      ? "Wet and Dry"
                      : selectedProduct.wet === true && selectedProduct.dry !== true
                        ? "Wet Only"
                        : selectedProduct.dry === true && selectedProduct.wet !== true
                          ? "Dry Only"
                          : "N/A"
                  }
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
    </>
  );
}

