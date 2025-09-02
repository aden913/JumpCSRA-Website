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
}: OptionCardProps) {
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
      {wetDryLabel && <div className="wetdry-box">{wetDryLabel}</div>}
      <button
        className="order-btn"
        onClick={() =>
          onOrder &&
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
          })
        }
      >
        ORDER NOW
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
          0: { slidesPerView: 1 },
        }}
        style={{ padding: ".5rem 0" }}
      >
        {options.map((opt: OptionCardProps) => (
          <SwiperSlide key={opt.name}>
            <OptionCard {...opt} onOrder={handleOrderNow} />
          </SwiperSlide>
        ))}
      </Swiper>

  <ProductDetailModal
    open={modalOpen}
    product={selectedProduct}
    onClose={() => setModalOpen(false)}
    onPurchase={onPurchase}
  />
    </>
  );
}
