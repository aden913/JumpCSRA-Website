import React, { useState, useRef, useEffect } from "react";
import { ProductDetailModal } from "./ProductDetailModal";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { ProductImageGallery } from "./ProductImageGallery";
import type { Swiper as SwiperType } from 'swiper';

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
  let fontSize = "1.5rem";
  if (name.length > 18) fontSize = "1.25rem";
  if (name.length > 28) fontSize = "1rem";

  let wetDryLabel = "";
  if (wet === true && dry === false) wetDryLabel = "Wet Only";
  else if (wet === false && dry === true) wetDryLabel = "Dry Only";
  else if (wet === true && dry === true) wetDryLabel = "Wet and Dry";

  const handleOrder = () => {
    if (unavailable) {
      return;
    }
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
  const [leftMaskWidth, setLeftMaskWidth] = useState(37);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOrderNow = (product: OptionCardProps) => {
    // Don't open modal for unavailable items
    if (product.unavailable) {
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

  // Function to calculate dynamic mask width
  const updateMaskWidth = () => {
    if (!swiperRef.current || !containerRef.current) return;

    const swiper = swiperRef.current;
    const containerWidth = containerRef.current.offsetWidth;
    const slides = swiper.slides;
    
    if (slides.length === 0) return;

    // Get the last visible slide (rightmost)
    const lastSlide = slides[slides.length - 1];
    const lastSlideRect = lastSlide.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate where the left edge of the last slide is relative to the container
    const lastSlideLeftPosition = lastSlideRect.left - containerRect.left;
    
    // Default mask width (37% of container)
    const defaultMaskWidth = containerWidth * 0.37;
    
    // Check if the last slide's left edge is encroaching on the mask
    if (lastSlideLeftPosition < defaultMaskWidth) {
      // Calculate how much the slide has entered the mask area
      const encroachmentDistance = defaultMaskWidth - lastSlideLeftPosition;
      
      // Reduce mask width proportionally to keep the slide visible
      // Minimum mask width should be enough to show at least part of the slide
      const minMaskWidth = Math.max(15, lastSlideLeftPosition - 20); // 20px buffer
      const newMaskWidth = Math.max(
        minMaskWidth,
        defaultMaskWidth - encroachmentDistance
      );
      
      setLeftMaskWidth((newMaskWidth / containerWidth) * 100);
    } else {
      // Reset to default when no encroachment
      setLeftMaskWidth(37);
    }
  };

  useEffect(() => {
    // Set up resize observer to handle container size changes
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      updateMaskWidth();
    });

    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <div className="carousel-container" ref={containerRef}>
        {/* Custom navigation arrows outside the swiper */}
        <button 
          className={`custom-nav-button custom-nav-prev ${isBeginning ? 'disabled' : ''}`}
          onClick={() => swiperRef.current?.slidePrev()}
          disabled={isBeginning}
        >
          &#8249;
        </button>
        
        <button 
          className={`custom-nav-button custom-nav-next ${isEnd ? 'disabled' : ''}`}
          onClick={() => swiperRef.current?.slideNext()}
          disabled={isEnd}
        >
          &#8250;
        </button>
        
        <Swiper
          modules={[Navigation]}
          slidesPerView={'auto'}
          spaceBetween={20}
          loop={false}
          navigation={false}
          watchOverflow={true}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            setIsBeginning(swiper.isBeginning);
            setIsEnd(swiper.isEnd);
          }}
          onSlideChange={(swiper) => {
            updateMaskWidth();
            setIsBeginning(swiper.isBeginning);
            setIsEnd(swiper.isEnd);
          }}
          breakpoints={{
            1024: { slidesPerView: 'auto', spaceBetween: 20 },
            768: { slidesPerView: 'auto', spaceBetween: 15 },
            464: { slidesPerView: 'auto', spaceBetween: 15 },
            0: { slidesPerView: 1, spaceBetween: 0 },
          }}
          style={{ padding: ".5rem 0" }}
        >
          {options.map((opt: OptionCardProps) => (
            <SwiperSlide key={opt.name}>
              <OptionCard {...opt} onOrder={() => handleOrderNow({ ...opt })} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <ProductDetailModal
        open={modalOpen}
        product={selectedProduct ? { ...selectedProduct } : null}
        onClose={() => setModalOpen(false)}
        onPurchase={handlePurchase}
      />
    </>
  );
}
