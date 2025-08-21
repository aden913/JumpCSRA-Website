import React, { useLayoutEffect, useState, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import {Navigation} from 'swiper/modules';
import "swiper/css";
import "swiper/css/navigation";
import "../styles/options-carousel.css";

export type OptionCardProps = {
  name: string;
  img: string;
  onOrder?: (name: string) => void;
};

function OptionCard({ name, img, onOrder }: OptionCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(true);

  useLayoutEffect(() => {
    function checkOverflow() {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setIsOverflow(textWidth > containerWidth);
      }
    }
    const id = requestAnimationFrame(checkOverflow);
    window.addEventListener('resize', checkOverflow);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [name]);

  return (
    <div className="option-card">
      <div className="option-title marquee-container" ref={containerRef}>
        <span
          ref={textRef}
          className={isOverflow ? "marquee-text" : ""}
        >
          {name}
        </span>
      </div>
      <img src={img} draggable="false" alt={name} className="option-img" />
      <button className="order-btn" onClick={() => onOrder && onOrder(name)}>ORDER NOW</button>
    </div>
  );
}

export type OptionsCarouselProps = {
  options: OptionCardProps[];
};

export function OptionsCarousel({ options }: OptionsCarouselProps) {
  return (
    <Swiper
      slidesPerView={3}
      modules={[Navigation]}
      spaceBetween={1}
      navigation
      breakpoints={{
        1024: { slidesPerView: 3 },
        464: { slidesPerView: 2 },
        0: { slidesPerView: 1 }
      }}
      style={{ padding: ".5rem 0" }}
    >
      {options.map((opt) => (
        <SwiperSlide key={opt.name}>
          <OptionCard {...opt} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

