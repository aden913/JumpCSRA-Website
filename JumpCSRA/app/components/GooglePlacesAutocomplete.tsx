'use client';

import React, { useRef, useEffect, useState } from 'react';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../utils/googleMapsLoader';

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  name?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Extract ZIP (postal_code) from Google Places result
 */
function getPostalCode(place: google.maps.places.PlaceResult): string | null {
  if (!place.address_components) return null;

  const postal = place.address_components.find(component =>
    component.types.includes('postal_code')
  );

  return postal?.long_name ?? null;
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  disabled = false,
  style = {},
  placeholder = 'Enter an address',
  name,
  inputRef: externalInputRef
}: GooglePlacesAutocompleteProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isSelectingPlace, setIsSelectingPlace] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  /**
   * Sync controlled value → local value
   */
  useEffect(() => {
    if (!isSelectingPlace && value !== localValue) {
      setLocalValue(value);
    }
  }, [value, isSelectingPlace, localValue]);

  /**
   * Load Google Maps API
   */
  useEffect(() => {
    if (isGoogleMapsLoaded()) {
      setIsLoaded(true);
      return;
    }

    loadGoogleMapsAPI()
      .then(() => setIsLoaded(true))
      .catch(() => {});
  }, []);

  /**
   * Initialize Places Autocomplete
   */
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    if (!window.google?.maps?.places?.Autocomplete) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: [
          'formatted_address',
          'address_components',
          'geometry',
          'place_id'
        ]
      }
    );

    const autocomplete = autocompleteRef.current;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.formatted_address || !place.geometry?.location) {
        onChange('');
        return;
      }

      setIsSelectingPlace(true);

      const zip = getPostalCode(place);

      let finalAddress = place.formatted_address;

      // Google often omits ZIP from formatted_address — append it
      if (zip && !finalAddress.includes(zip)) {
        finalAddress = `${finalAddress}, ${zip}`;
      }

      // Update immediately
      setLocalValue(finalAddress);

      if (inputRef.current) {
        inputRef.current.value = finalAddress;
      }

      onChange(finalAddress);
      onPlaceSelected?.(place);

console.table(
  place.address_components?.map(c => ({
    types: c.types.join(", "),
    value: c.long_name
  }))
);


      // Allow normal typing again
      setTimeout(() => setIsSelectingPlace(false), 100);
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange, onPlaceSelected]);

  /**
   * Handle manual typing
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSelectingPlace) return;

    const typedValue = e.target.value;
    setLocalValue(typedValue);
    onChange(typedValue);
  };

  return (
    <input
      ref={inputRef}
      name={name}
      value={localValue}
      onChange={handleInputChange}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete="off"
      style={{
        minWidth: '200px',
        width: `${Math.max(200, localValue.length * 8 + 40)}px`,
        maxWidth: '100%',
        transition: 'width 0.2s ease',
        ...style
      }}
    />
  );
}
