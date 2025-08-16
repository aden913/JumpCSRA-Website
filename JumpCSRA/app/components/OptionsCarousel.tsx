import React, { useLayoutEffect, useState, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

export type OptionCardProps = {
  name: string;
  img: string;
};

function OptionCard({ name, img }: OptionCardProps) {
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
      <button className="order-btn">ORDER NOW</button>
    </div>
  );
}

export type OptionsCarouselProps = {
  options: OptionCardProps[];
};

export function OptionsCarousel({ options }: OptionsCarouselProps) {
  return (
    <Swiper
      slidesPerView={6}
      spaceBetween={24}
      navigation={true}
      breakpoints={{
        1024: { slidesPerView: 6 },
        464: { slidesPerView: 2 },
        0: { slidesPerView: 1 }
      }}
      style={{ padding: "1rem 0" }}
    >
      {options.map((opt) => (
        <SwiperSlide key={opt.name}>
          <OptionCard name={opt.name} img={opt.img} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

