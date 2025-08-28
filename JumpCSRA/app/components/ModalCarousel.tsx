import React from "react";
import OptionsCarousel from "./OptionsCarousel";
import type { OptionCardProps } from "./OptionCard";
import "../styles/modal.css";


type ModalCarouselProps = {
  open: boolean;
  onClose: () => void;
  options: OptionCardProps[];
  title: string;
};

export function ModalCarousel({ open, onClose, options, title }: ModalCarouselProps) {
  const dragRef = React.useRef(false);
  if (!open) return null;
  // Only close modal if mouse/touch is not a drag
  const handleOverlayMouseDown = () => { dragRef.current = false; };
  const handleOverlayMouseMove = () => { dragRef.current = true; };
  const handleOverlayMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) onClose();
  };
  const handleOverlayTouchStart = () => { dragRef.current = false; };
  const handleOverlayTouchMove = () => { dragRef.current = true; };
  const handleOverlayTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current) onClose();
  };
  return (
    <div
      className="modal-overlay fade-in"
      onMouseDown={handleOverlayMouseDown}
      onMouseMove={handleOverlayMouseMove}
      onMouseUp={handleOverlayMouseUp}
      onTouchStart={handleOverlayTouchStart}
      onTouchMove={handleOverlayTouchMove}
      onTouchEnd={handleOverlayTouchEnd}
    >
      <div className="modal-shadow" />
      <div className="modal-content popup" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <OptionsCarousel options={options} />
        <button className="modal-close" onClick={onClose}>X</button>
      </div>
    </div>
  );
}
