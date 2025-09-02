import React from "react";
import { DatePicker } from "@mantine/dates";
import '@mantine/dates/styles.css';
import "../styles/calendar.css";
import '@mantine/core/styles.css';
export type CalendarSidebarProps = {
  open: boolean;
  onClose: () => void;
  value: [Date | null, Date | null];
  onChange: (value: [Date | null, Date | null]) => void;
};

export function CalendarSidebar({ open, onClose, value, onChange }: CalendarSidebarProps) {
  // Convert Date[] to string[] for DatePicker
  const stringValue: [string | null, string | null] = [
    value[0] ? value[0].toISOString().slice(0, 10) : null,
    value[1] ? value[1].toISOString().slice(0, 10) : null,
  ];

  // Convert string[] from DatePicker to Date[] for parent
  const handleChange = (val: [string | null, string | null]) => {
    onChange([
      val[0] ? new Date(val[0]) : null,
      val[1] ? new Date(val[1]) : null,
    ]);
  };

  return (
    <>
      <div className={`calendar-overlay${open ? " open" : ""}`} onClick={onClose}></div>
      <div className={`calendar-sidebar${open ? " open" : ""}`}>
<div className="topCalendar">
        <button className="close-btn" onClick={onClose}>
          X
        </button>
        <h2 className="calendar-sidebar-title">Select Event Date Range</h2>
        </div>
        <DatePicker
          type="range"
          value={stringValue}
          onChange={handleChange}
          minDate={new Date()}
          size="lg"
        />
      </div>
    </>
  );
}
