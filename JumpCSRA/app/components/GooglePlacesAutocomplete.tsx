'use client';

import React, { useRef, useEffect, useState } from 'react';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../utils/googleMapsLoader';

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult, formattedAddress: string) => void;
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
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isSelectingPlace, setIsSelectingPlace] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onChange, onPlaceSelected]);

  /**
   * Sync controlled value -> local value
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
   * Initialize Places Autocomplete once. Callback refs keep handlers current.
   */
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    if (!window.google?.maps?.places?.Autocomplete) return;

    const autocomplete = new google.maps.places.Autocomplete(
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

    autocompleteRef.current = autocomplete;

    const placeChangedListener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.formatted_address || !place.geometry?.location) {
        onChangeRef.current('');
        return;
      }

      setIsSelectingPlace(true);

      const zip = getPostalCode(place);
      let finalAddress = place.formatted_address;

      // Google often omits ZIP from formatted_address, so append it for display/storage.
      if (zip && !finalAddress.includes(zip)) {
        finalAddress = `${finalAddress}, ${zip}`;
      }

      setLocalValue(finalAddress);

      if (inputRef.current) {
        inputRef.current.value = finalAddress;
      }

      console.log('[GOOGLE PLACES AUTOCOMPLETE] place_changed', {
        finalAddress,
        googleFormattedAddress: place.formatted_address,
        placeId: place.place_id,
        hasGeometry: Boolean(place.geometry?.location),
      });

      onPlaceSelectedRef.current?.(place, finalAddress);
      onChangeRef.current(finalAddress);

      console.table(
        place.address_components?.map(c => ({
          types: c.types.join(', '),
          value: c.long_name
        }))
      );

      setTimeout(() => setIsSelectingPlace(false), 100);
    });

    return () => {
      google.maps.event.removeListener(placeChangedListener);
      autocompleteRef.current = null;
    };
  }, [isLoaded, inputRef]);

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