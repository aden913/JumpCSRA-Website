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
              <button className="close-btn" onClick={onClose}>
                X
              </button>
              <h2 className="calendar-sidebar-title">Select Event Date Range</h2>
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
            <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "1.1rem" }}>
              <strong>Selected Date:</strong><br />
              {value[0] ? value[0].toLocaleDateString() : "--"}
              <br />
              {value[0] && (
                <button
                  style={{ marginTop: "1rem", padding: "0.5rem 1.5rem", fontSize: "1rem", background: "#2e8b57", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  onClick={onClose}
                >
                  Close Sidebar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
