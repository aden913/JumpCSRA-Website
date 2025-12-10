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
  selectedWetDry: string;
  onWetDryChange: (wetDry: string) => void;
};

export function CalendarSidebar({ open, onClose, value, onChange, selectedWetDry, onWetDryChange }: CalendarSidebarProps) {
  // Convert Date[] to string[] for DatePicker
  const stringValue: [string | null, string | null] = [
    value[0] ? value[0].toISOString().slice(0, 10) : null,
    value[1] ? value[1].toISOString().slice(0, 10) : null,
  ];

  // Convert string[] from DatePicker to Date[] for parent
  const handleChange = (val: [string | null, string | null]) => {
    // Parse as local midnight to avoid off-by-one
    const parseLocal = (s: string | null) => s ? new Date(s + 'T00:00') : null;
    const start = parseLocal(val[0]);
    const end = parseLocal(val[1]);
    // Limit to max 3 days
    if (start && end) {
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diff > 2) {
        // If range is too large, set end to start + 2 days
        const limitedEnd = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
        onChange([start, limitedEnd]);
        return;
      }
    }
    onChange([start, end]);
  };

  return (
    <>
      {open && (
        <>
          <div className="calendar-overlay open" onClick={onClose}></div>
          <div className="calendar-sidebar open">
            <div className="topCalendar">
              
              <h2 className="calendar-sidebar-title">Event Start Date</h2>
            </div>
            <DatePicker
              type="default"
              value={stringValue[0]}
              onChange={(val) => {
                // val is string | null
                const date = val ? new Date(val + 'T00:00') : null;
                onChange([date, date]);
                // Don't auto-close immediately to avoid state timing issues
                // User can click the Close button instead
              }}
              minDate={new Date()}
              size="lg"
            />
            
            {/* Wet/Dry Selection - shown after date is selected */}
            {value[0] && (
              <div className="wetdry-selection-container">
                <h3 className="wetdry-selection-title">
                  What type of inflatables are you looking for?
                </h3>
                <div className="wetdry-options-container">
                  <label className={`wetdry-option-label ${selectedWetDry === 'dry' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="wetDry"
                      value="dry"
                      checked={selectedWetDry === 'dry'}
                      onChange={(e) => onWetDryChange(e.target.value)}
                      className="wetdry-option-input"
                    />
                    Dry
                  </label>
                  <div className="wetdry-divider"></div>
                  <label className={`wetdry-option-label ${selectedWetDry === 'wet' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="wetDry"
                      value="wet"
                      checked={selectedWetDry === 'wet'}
                      onChange={(e) => onWetDryChange(e.target.value)}
                      className="wetdry-option-input"
                    />
                    Wet
                  </label>
                </div>
              </div>
            )}
            
            <div className="confirm-section">
              {value[0] && (
                <button
                  className="confirm-button"
                  onClick={onClose}
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
