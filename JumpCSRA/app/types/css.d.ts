// Type declarations for CSS imports
declare module "*.css" {
  const content: any;
  export default content;
}

// Specifically for swiper CSS imports
declare module "swiper/css";
declare module "swiper/css/navigation";
declare module "swiper/css/pagination";
declare module "swiper/css/scrollbar";
declare module "swiper/css/bundle";