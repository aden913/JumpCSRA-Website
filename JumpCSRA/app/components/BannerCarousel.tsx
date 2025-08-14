import React from "react";
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";

export function BannerCarousel() {
  return (
    <Carousel
      showThumbs={false}
      showStatus={false}
      showIndicators={false}
      showArrows={false}
      infiniteLoop
      autoPlay
      interval={3500}
      swipeable
      emulateTouch
    >
      <div>
        <h1>Turn your backyard into the ultimate party zone!</h1>
      </div>
      <div>
        <h1>A water park in your driveway — without the lines!</h1>
      </div>
      <div>
        <h1>One click = a stress-free party they’ll never forget!</h1>
      </div>
    </Carousel>
  );
}
