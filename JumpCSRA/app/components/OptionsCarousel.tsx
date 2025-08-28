
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import OptionCard from "./OptionCard";

type OptionCardProps = {
  name: string;
  img?: string;
  description?: string;
  weekdayPrice?: number;
  weekendPrice?: number;
  weekdayWaterPrice?: number;
  weekendWaterPrice?: number;
  dimensions?: string;
  wet?: boolean;
  dry?: boolean;
  onOrder?: () => void;
};

type OptionsCarouselProps = {
  options: OptionCardProps[];
};

export default function OptionsCarousel({ options }: OptionsCarouselProps) {
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
      {options.map((opt) => (
        <SwiperSlide key={opt.name}>
          <OptionCard {...opt} onOrder={opt.onOrder} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

