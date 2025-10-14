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

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  disabled = false,
  style = {},
  placeholder = "Enter an address",
  name,
  inputRef: externalInputRef
}: GooglePlacesAutocompleteProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSelectingPlace, setIsSelectingPlace] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    if (isGoogleMapsLoaded()) {
      setIsLoaded(true);
      return;
    }

    loadGoogleMapsAPI()
      .then(() => {
        setIsLoaded(true);
      })
      .catch((error) => {
        // Failed to load Google Maps API
      });
  }, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    // Double-check that Google Places Autocomplete is available
    if (!window.google?.maps?.places?.Autocomplete) {
      setTimeout(() => {
        // Trigger re-check by toggling isLoaded state
        setIsLoaded(false);
        setTimeout(() => setIsLoaded(true), 100);
      }, 200);
      return;
    }

    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' }, // Restrict to US addresses
      });

      const autocomplete = autocompleteRef.current;

      // Listen for place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        // Validate that we have a proper place with formatted address and geometry
        if (place.formatted_address && place.geometry?.location) {
          setIsSelectingPlace(true);
          
          // Use Google's exact formatted address
          const validatedAddress = place.formatted_address;
          
          // Update the input field with the validated address
          if (inputRef.current) {
            inputRef.current.value = validatedAddress;
          }
          
          // Call onPlaceSelected first to mark as valid Google selection
          if (onPlaceSelected) {
            onPlaceSelected(place);
          }
          
          // Call onChange after onPlaceSelected to update the input value
          if (onChange) {
            onChange(validatedAddress);
          }
          
          // Reset flag after a short delay
          setTimeout(() => setIsSelectingPlace(false), 100);
        } else {
          // Invalid place selection - clear the field or show error
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          onChange('');
        }
      });
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange, onPlaceSelected]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typedValue = e.target.value;
    
    // Don't trigger onChange if we're currently selecting a place from Google Places
    if (isSelectingPlace) {
      return;
    }
    
    // Call onChange to update the parent component's state
    // The parent component will handle validation logic
    if (onChange) {
      onChange(typedValue);
    }
  };

  return (
    <input
      ref={inputRef}
      name={name}
      value={value}
      onChange={handleInputChange}
      disabled={disabled}
      style={{
        minWidth: '200px',
        width: `${Math.max(200, (value.length * 8) + 40)}px`,
        maxWidth: '100%',
        transition: 'width 0.2s ease',
        ...style
      }}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}