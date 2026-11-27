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
  const searchBarRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return [
      ...categories.map(name => ({ name, product: null })),
      ...inflateables
        .filter(product => !categories.includes(product.name))
        .map(product => ({ name: product.name, product })),
    ].filter(({ name }) => name.toLowerCase().includes(term));
  }, [searchTerm, inflateables, categories]);

  const handleSuggestionClick = ({ name, product }: (typeof suggestions)[number]) => {
    setSearchTerm("");
    setShowSuggestions(false);
    if (product) {
      onInflateableSelect(product);
    } else {
      onCategorySelect(name);
      if (focusCarousel) {
        setTimeout(focusCarousel, 100);
      }
    }
  };

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowSuggestions(false);
    }

    function handleOutsidePress(e: PointerEvent) {
      if (e.target instanceof Node && !searchBarRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("keydown", handleEsc);
    document.addEventListener("pointerdown", handleOutsidePress, true);
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("pointerdown", handleOutsidePress, true);
    };
  }, []);

  return (
    <div ref={searchBarRef} className="search-bar-container">
      <input
        type="text"
        placeholder="Search by Name..."
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          setShowSuggestions(true);
        }}
        className="search-bar-input"
        onFocus={() => setShowSuggestions(true)}
        onClick={() => setShowSuggestions(true)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="search-suggestions">
          {suggestions.map((item) => (
            <li
              key={item.name}
              className="search-suggestion-item"
              onClick={() => handleSuggestionClick(item)}
            >
              {item.product?.img && (
                <img className="search-suggestion-image" src={item.product.img} alt="" />
              )}
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
