import React, { useState, useRef, useEffect, useMemo } from "react";
import "../styles/search.css";

interface SearchBarProps {
  inflateables: any[];
  categories: string[];
  onCategorySelect: (category: string) => void;
  onInflateableSelect: (product: any) => void;
  focusCarousel?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  inflateables,
  categories,
  onCategorySelect,
  onInflateableSelect,
  focusCarousel,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build searchable list (names + categories)
  const searchableList = useMemo(() => {
    const names = inflateables.map((i: any) => i.name);
  const list = [...categories, ...names.filter((n: string) => !categories.includes(n))];
  return list;
  }, [inflateables, categories]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = searchableList.filter((item: string) => item.toLowerCase().includes(term));
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [searchTerm, searchableList]);

  const handleSuggestionClick = (item: string) => {
    setSearchTerm("");
    setShowSuggestions(false);
    if (categories.includes(item)) {
      onCategorySelect(item);
      if (focusCarousel) {
        setTimeout(() => {
          focusCarousel();
        }, 100);
      }
    } else {
      // Find the full product object
      const product = inflateables.find((i: any) => (i.name || "").trim().toLowerCase() === item.trim().toLowerCase());
      if (product) {
        onInflateableSelect(product);
      }
    }
  };

  useEffect(() => {
  function handleEsc(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="search-bar-container">
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
        }}
        ref={searchInputRef}
        className="search-bar-input"
        onFocus={() => {
          setShowSuggestions(suggestions.length > 0);
        }}
      />
      {showSuggestions && (
        <ul className="search-suggestions">
          {suggestions.map((item) => (
            <li
              key={item}
              className="search-suggestion-item"
              onClick={() => handleSuggestionClick(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
