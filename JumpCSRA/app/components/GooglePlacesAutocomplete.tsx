import React, { useRef, useEffect, useState } from 'react';

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  name?: string;
}

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = 'AIzaSyB4F9liX4qhB8-lAsNSbaNadZ8dsxjE2Ao';

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  disabled = false,
  style = {},
  placeholder = "Enter an address",
  name
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    if (window.google?.maps?.places) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps API');
    
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts before loading
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' }, // Restrict to US addresses
      });

      const autocomplete = autocompleteRef.current;

      // Listen for place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address) {
          onChange(place.formatted_address);
          
          if (onPlaceSelected) {
            onPlaceSelected(place);
          }
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
    onChange(e.target.value);
  };

  return (
    <input
      ref={inputRef}
      name={name}
      value={value}
      onChange={handleInputChange}
      disabled={disabled}
      style={style}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}