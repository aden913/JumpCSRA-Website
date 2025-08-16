import React, { useLayoutEffect, useState, useRef } from "react";
import Carousel from "react-multi-carousel";

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
    <Carousel
      ssr={true}
      infinite={true}
      responsive={{
        desktop: { breakpoint: { max: 3000, min: 1024 }, items: 6, slidesToSlide: 6 },
        tablet: { breakpoint: { max: 1024, min: 464 }, items: 2, slidesToSlide: 2 },
        mobile: { breakpoint: { max: 464, min: 0 }, items: 1, slidesToSlide: 1 }
      }}
      arrows
      keyBoardControl={true}
      containerClass="options-carousel"
      itemClass="carousel-item-padding-40-px"
    >
      {options.map(opt => (
        <OptionCard key={opt.name} name={opt.name} img={opt.img} />
      ))}
    </Carousel>
  );
}
