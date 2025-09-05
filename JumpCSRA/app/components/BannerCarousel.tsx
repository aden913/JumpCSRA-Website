import React from "react";
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";
import "../styles/carousel.css";

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
        <h1 className="banner-carousel">Turn your backyard into the ultimate party zone!</h1>
      </div>
      <div>
        <h1 className="banner-carousel">A water park in your driveway — without the lines!</h1>
      </div>
      <div>
        <h1 className="banner-carousel">One click = a stress-free party they’ll never forget!</h1>
      </div>
    </Carousel>
  );
}
