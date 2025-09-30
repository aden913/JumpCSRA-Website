import React, { useState } from "react";
import { ProductDetailModal } from "./ProductDetailModal";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { ProductImageGallery } from "./ProductImageGallery";

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
  wetDry?: string;
  category?: string;
  unavailable?: boolean;
};

function OptionCard({
  name,
  img,
  price,
  description,
  dimensions,
  wet,
  dry,
  weekdayPrice,
  weekendPrice,
  weekdayWaterPrice,
  weekendWaterPrice,
  onOrder,
  unavailable,
}: OptionCardProps) {
  let fontSize = "1.2rem";
  if (name.length > 18) fontSize = "1rem";
  if (name.length > 28) fontSize = ".85rem";

  let wetDryLabel = "";
  if (wet === true && dry === false) wetDryLabel = "Wet Only";
  else if (wet === false && dry === true) wetDryLabel = "Dry Only";
  else if (wet === true && dry === true) wetDryLabel = "Wet and Dry";

  const handleOrder = () => {
    if (unavailable) {
      console.log(`Attempted to order unavailable inflateable: ${name}`);
      return;
    }
    console.log(`Ordering available inflateable: ${name}`);
    if (onOrder) {
      onOrder({
        name,
        img,
        price,
        description,
        dimensions,
        wet,
        dry,
        weekdayPrice,
        weekendPrice,
        weekdayWaterPrice,
        weekendWaterPrice,
        unavailable,
      });
    }
  };

  return (
    <div className={`option-card${unavailable ? " option-card-unavailable" : ""}`}>
      <div className="option-title marquee-container" style={{ fontSize }}>
        <span>{name}</span>
      </div>
      <img 
        src={img} 
        draggable="false" 
        alt={name} 
        className="option-img" 
        style={unavailable ? { filter: "grayscale(1)", opacity: 0.6 } : {}}
      />
      {wetDryLabel && <div className="wetdry-box">{wetDryLabel}</div>}
      <button
        className="order-btn"
        onClick={handleOrder}
        disabled={unavailable}
        style={unavailable ? { backgroundColor: "#ccc", cursor: "not-allowed" } : {}}
      >
        {unavailable ? "UNAVAILABLE" : "ORDER NOW"}
      </button>
    </div>
  );
}

export type OptionsCarouselProps = {
  options: OptionCardProps[];
  onPurchase?: (product: OptionCardProps) => void;
};

export function OptionsCarousel({ options, onPurchase }: OptionsCarouselProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OptionCardProps | null>(null);

  const handleOrderNow = (product: OptionCardProps) => {
    // Don't open modal for unavailable items
    if (product.unavailable) {
      console.log(`Cannot order unavailable inflateable: ${product.name}`);
      return;
    }
    // Always pass the full product object
    setSelectedProduct({ ...product });
    setModalOpen(true);
  };

  const handlePurchase = (product: OptionCardProps) => {
    if (onPurchase) onPurchase(product);
    setModalOpen(false);
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
          0: { slidesPerView: 1 },
        }}
        style={{ padding: ".5rem 0" }}
      >
        {options.map((opt: OptionCardProps) => (
          <SwiperSlide key={opt.name}>
            <OptionCard {...opt} onOrder={() => handleOrderNow({ ...opt })} />
          </SwiperSlide>
        ))}
      </Swiper>

      <ProductDetailModal
        open={modalOpen}
        product={selectedProduct ? { ...selectedProduct } : null}
        onClose={() => setModalOpen(false)}
        onPurchase={handlePurchase}
      />
    </>
  );
}
