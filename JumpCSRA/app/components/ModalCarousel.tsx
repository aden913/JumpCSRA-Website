import React from "react";
import { OptionsCarousel } from "./OptionsCarousel";
import type { OptionCardProps } from "./OptionsCarousel";

type ModalCarouselProps = {
  open: boolean;
  onClose: () => void;
  options: OptionCardProps[];
  title: string;
};

export function ModalCarousel({ open, onClose, options, title }: ModalCarouselProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <OptionsCarousel options={options} />
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
