import React, { useLayoutEffect, useState, useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from 'swiper/modules';
import { getDatabase, ref, onValue } from "firebase/database";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./FirebaseConfig";


import "swiper/css";
import "swiper/css/navigation";
import "../styles/options-carousel.css";
import "../styles/options.css";

export type OptionCardProps = {
  name: string;
  img: string;
  onOrder?: (name: string) => void;
};

function OptionCard({ name, img, onOrder }: OptionCardProps) {
  // Dynamically scale font size if name is too long
  let fontSize = "1.2rem";
  if (name.length > 18) fontSize = "1rem";
  if (name.length > 28) fontSize = ".85rem";

  return (
    <div className="option-card">
      <div className="option-title marquee-container" style={{ fontSize }}>
        <span>{name}</span>
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
  // Firebase setup
  const [inflateables, setInflateables] = useState<OptionCardProps[]>([]);
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

  return (
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
          <OptionCard {...opt} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

