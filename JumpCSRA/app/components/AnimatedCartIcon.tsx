import React, { useEffect, useRef } from 'react';

type AnimatedCartIconProps = {
  width?: number;
  height?: number;
  speed?: number;
  autoplay?: boolean;
  loop?: boolean;
  className?: string;
};

export function AnimatedCartIcon({
  width = 84,
  height = 84,
  speed = 1,
  autoplay = true,
  loop = true,
  className = ''
}: AnimatedCartIconProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLottie = async () => {
      try {
        // Dynamically import the lottie player
        await import('@lottiefiles/lottie-player');
        
        if (containerRef.current) {
          // Create the lottie-player element
          const lottieElement = document.createElement('lottie-player') as any;
          lottieElement.setAttribute('src', '/anim_cart_icon.json');
          lottieElement.setAttribute('background', 'transparent');
          lottieElement.setAttribute('speed', speed.toString());
          lottieElement.style.width = `${width}px`;
          lottieElement.style.height = `${height}px`;
          if (loop) lottieElement.setAttribute('loop', '');
          if (autoplay) lottieElement.setAttribute('autoplay', '');
          if (className) lottieElement.className = className;
          
          // Clear container and append the element
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(lottieElement);
        }
      } catch (error) {
        console.error('Failed to load Lottie animation:', error);
        // Fallback to static cart icon
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <img 
              src="/white-cart.png" 
              alt="Cart" 
              class="menu-icon-img cart-icon ${className}"
              style="width: ${width}px; height: ${height}px;"
            />
          `;
        }
      }
    };

    loadLottie();
  }, [width, height, speed, autoplay, loop, className]);

  return <div ref={containerRef} style={{ width: `${width}px`, height: `${height}px` }} />;
}

// Fallback component using img tag if Lottie fails to load
export function StaticCartIcon({ className = '' }: { className?: string }) {
  return (
    <img 
      src="/white-cart.png" 
      alt="Cart" 
      className={`menu-icon-img cart-icon ${className}`}
      style={{ width: '84px', height: '84px' }}
    />
  );
}