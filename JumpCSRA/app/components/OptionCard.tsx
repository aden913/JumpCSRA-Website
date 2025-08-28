import React from "react";

export type OptionCardProps = {
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

const OptionCard: React.FC<OptionCardProps> = ({
  name,
  img,
  description,
  weekdayPrice,
  weekendPrice,
  weekdayWaterPrice,
  weekendWaterPrice,
  dimensions,
  wet,
  dry,
  onOrder,
}) => {
  return (
    <div className="option-card">
      {img && <img src={img} alt={name} className="option-card-img" />}
      <h3>{name}</h3>
      {description && <p>{description}</p>}
      <div className="option-card-details">
        <div><strong>Weekday (Dry):</strong> {typeof weekdayPrice === "number" ? `$${weekdayPrice}` : "N/A"}</div>
        <div><strong>Weekend (Dry):</strong> {typeof weekendPrice === "number" ? `$${weekendPrice}` : "N/A"}</div>
        <div><strong>Weekday (Wet):</strong> {typeof weekdayWaterPrice === "number" ? `$${weekdayWaterPrice}` : "N/A"}</div>
        <div><strong>Weekend (Wet):</strong> {typeof weekendWaterPrice === "number" ? `$${weekendWaterPrice}` : "N/A"}</div>
        <div><strong>Dimensions:</strong> {dimensions || "N/A"}</div>
        <div><strong>Wet/Dry:</strong> {
          wet && dry ? "Wet and Dry" :
          wet ? "Wet Only" :
          dry ? "Dry Only" : "N/A"
        }</div>
      </div>
      {onOrder && (
        <button className="option-card-order" onClick={onOrder}>Order Now</button>
      )}
    </div>
  );
};

export default OptionCard;
