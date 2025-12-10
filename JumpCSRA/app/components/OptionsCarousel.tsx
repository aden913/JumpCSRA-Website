import React, { useState, useRef, useEffect, useImperativeHandle } from "react";
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
  onCardClick?: (product: OptionCardProps) => void; // New prop for card click behavior
  wetDry?: string;
  category?: string;
  unavailable?: boolean;
  directSelection?: boolean; // New prop to control selection behavior
  isLandingPage?: boolean; // New prop to identify landing page context
  selectedDates?: [Date | null, Date | null]; // New prop for pricing calculation
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
  onCardClick,
  unavailable,
  directSelection,
  isLandingPage,
  selectedDates,
  cardRef,
  normalizedDimensions,
}: OptionCardProps & { 
  cardRef?: (element: HTMLDivElement | null) => void; 
  normalizedDimensions?: {width: number, height: number} | null;
}) {
  let fontSize = "1.5rem";
  if (name.length > 18) fontSize = "1.25rem";
  if (name.length > 28) fontSize = "1rem";

  // Calculate pricing based on selected dates
  const calculateDisplayPrice = () => {
    if (!selectedDates || !selectedDates[0] || !weekdayPrice || !weekendPrice) {
      return null;
    }

    const selectedDate = selectedDates[0];
    const dayOfWeek = selectedDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

    return isWeekend ? weekendPrice : weekdayPrice;
  };

  const displayPrice = calculateDisplayPrice();

  const productData = {
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
    directSelection,
    isLandingPage,
    selectedDates,
  };

  const handleCardClick = () => {
    if (unavailable) return;
    
    if (isLandingPage && onCardClick) {
      // Landing page: card click shows details popup
      onCardClick(productData);
    } else if (onOrder) {
      // Other locations: card click behaves like order button
      onOrder(productData);
    }
  };

  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    if (unavailable) return;
    
    if (isLandingPage && onOrder) {
      // Landing page: order button adds directly to cart
      onOrder(productData);
    } else if (onOrder) {
      // Other locations: order button shows details popup (existing behavior)
      onOrder(productData);
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`option-card${unavailable ? " option-card-unavailable" : ""}`}
      onClick={handleCardClick}
      style={{ 
        cursor: unavailable ? "not-allowed" : "pointer",
        ...(normalizedDimensions ? {
          minWidth: `${normalizedDimensions.width}px`,
          minHeight: `${normalizedDimensions.height}px`,
          width: `${normalizedDimensions.width}px`,
          height: `${normalizedDimensions.height}px`
        } : {})
      }}
    >
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
      <div className="option-card-bottom">
        {displayPrice && <div className="price-box">${displayPrice}</div>}
        <button
          className="order-btn"
          onClick={handleOrderClick}
          disabled={unavailable}
          style={unavailable ? { backgroundColor: "#ccc", cursor: "not-allowed" } : {}}
        >
          {unavailable ? "UNAVAILABLE" : (directSelection ? "SELECT" : "ADD TO CART")}
        </button>
      </div>
    </div>
  );
}

export type OptionsCarouselProps = {
  options: OptionCardProps[];
  onPurchase?: (product: OptionCardProps) => void;
  onCardClick?: (product: OptionCardProps) => void; // New prop for handling card clicks
  disableModal?: boolean; // New prop to disable modal behavior
  isLandingPage?: boolean; // New prop to identify landing page context
  selectedDates?: [Date | null, Date | null]; // New prop for pricing calculation
};

export interface OptionsCarouselRef {
  resetToBeginning: () => void;
}

export const OptionsCarousel = React.forwardRef<OptionsCarouselRef, OptionsCarouselProps>(
  ({ options, onPurchase, onCardClick, disableModal = false, isLandingPage = false, selectedDates }, ref) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OptionCardProps | null>(null);
  const [leftMaskWidth, setLeftMaskWidth] = useState(37);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const [cardDimensions, setCardDimensions] = useState<{width: number, height: number} | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Expose reset method to parent components
  useImperativeHandle(ref, () => ({
    resetToBeginning: () => {
      if (swiperRef.current) {
        swiperRef.current.slideTo(0, 300); // Slide to first slide with 300ms animation
      }
    }
  }), []);

  const handleOrderNow = (product: OptionCardProps) => {
    // Don't open modal for unavailable items
    if (product.unavailable) {
      return;
    }
    
    // If disableModal is true or directSelection is true, don't show modal
    if (disableModal || product.directSelection) {
      if (onPurchase) onPurchase(product);
      return;
    }
    
    // For landing page, order button adds directly to cart
    if (isLandingPage) {
      if (onPurchase) onPurchase(product);
      return;
    }
    
    // Otherwise, show the modal (for other locations)
    setSelectedProduct({ ...product });
    setModalOpen(true);
  };

  const handleCardClick = (product: OptionCardProps) => {
    // Don't open modal for unavailable items
    if (product.unavailable) {
      return;
    }
    
    if (onCardClick) {
      onCardClick(product);
    } else if (!isLandingPage) {
      // For non-landing pages, card click shows modal (existing behavior)
      setSelectedProduct({ ...product });
      setModalOpen(true);
    }
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

  // Effect to measure and normalize card dimensions
  useEffect(() => {
    const measureCards = () => {
      if (cardRefs.current.length === 0) return;

      let maxWidth = 0;
      let maxHeight = 0;

      // Measure all cards to find the largest dimensions
      cardRefs.current.forEach(cardElement => {
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          maxWidth = Math.max(maxWidth, rect.width);
          maxHeight = Math.max(maxHeight, rect.height);
        }
      });

      // Only update if we have valid measurements and they've changed
      if (maxWidth > 0 && maxHeight > 0) {
        const newDimensions = { width: maxWidth, height: maxHeight };
        setCardDimensions(prev => {
          if (!prev || prev.width !== maxWidth || prev.height !== maxHeight) {
            return newDimensions;
          }
          return prev;
        });
      }
    };

    // Measure after initial render
    const timer = setTimeout(measureCards, 100);

    // Set up resize observer for responsive changes
    const resizeObserver = new ResizeObserver(measureCards);
    
    cardRefs.current.forEach(cardElement => {
      if (cardElement) {
        resizeObserver.observe(cardElement);
      }
    });

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [options]); // Re-measure when options change

  // Effect to properly initialize navigation state after Swiper is ready
  useEffect(() => {
    const updateNavigationState = () => {
      if (swiperRef.current) {
        const swiper = swiperRef.current;
        // Force Swiper to update its state
        swiper.update();
        setIsBeginning(swiper.isBeginning);
        setIsEnd(swiper.isEnd);
      }
    };

    // Update navigation state after a short delay to ensure Swiper is fully initialized
    const timer = setTimeout(updateNavigationState, 200);
    
    // Also update on window resize
    const handleResize = () => {
      setTimeout(updateNavigationState, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [options]); // Re-run when options change

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
          loop={false}
          centeredSlides={true}
          centerInsufficientSlides={true}
          navigation={false}
          watchOverflow={true}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            setIsBeginning(swiper.isBeginning);
            setIsEnd(swiper.isEnd);
            
            // Update state again after a short delay to ensure accuracy
            setTimeout(() => {
              swiper.update();
              setIsBeginning(swiper.isBeginning);
              setIsEnd(swiper.isEnd);
            }, 100);
          }}
          onSlideChange={(swiper) => {
            updateMaskWidth();
            setIsBeginning(swiper.isBeginning);
            setIsEnd(swiper.isEnd);
          }}
          breakpoints={{
            0: { slidesPerView: 1, spaceBetween: 10 },
            480: { slidesPerView: 2, spaceBetween: 15 },
            1024: { slidesPerView: 'auto', spaceBetween: 20 },
          }}
          style={{ padding: ".5rem 0" }}
        >
          {options.map((opt: OptionCardProps, index: number) => {
            // Ensure we have a ref for this card
            if (!cardRefs.current[index]) {
              cardRefs.current[index] = null;
            }

            return (
              <SwiperSlide key={opt.name}>
                <OptionCard 
                  {...opt} 
                  onOrder={() => handleOrderNow({ ...opt })} 
                  onCardClick={() => handleCardClick({ ...opt })}
                  isLandingPage={isLandingPage}
                  selectedDates={selectedDates}
                  cardRef={(element: HTMLDivElement | null) => {
                    cardRefs.current[index] = element;
                  }}
                  normalizedDimensions={cardDimensions}
                />
              </SwiperSlide>
            );
          })}
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
});
