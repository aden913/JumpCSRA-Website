'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  BackendPlacePrediction,
  fetchPlaceDetails,
  fetchPlacePredictions,
} from '../utils/backendPlacesService';

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

  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const sessionTokenRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [isSelectingPlace, setIsSelectingPlace] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [predictions, setPredictions] = useState<BackendPlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

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

  useEffect(() => {
    const typedValue = localValue.trim();

    if (disabled || isSelectingPlace || typedValue.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    const requestId = window.setTimeout(async () => {
      setIsLoadingPredictions(true);
      try {
        const nextPredictions = await fetchPlacePredictions(typedValue, sessionTokenRef.current);
        setPredictions(nextPredictions);
        setIsOpen(nextPredictions.length > 0);
      } catch (error) {
        console.warn('[PLACES AUTOCOMPLETE] predictions failed', error);
        setPredictions([]);
        setIsOpen(false);
      } finally {
        setIsLoadingPredictions(false);
      }
    }, 250);

    return () => window.clearTimeout(requestId);
  }, [disabled, isSelectingPlace, localValue]);

  const buildGoogleCompatiblePlace = (
    placeDetails: Awaited<ReturnType<typeof fetchPlaceDetails>>
  ): google.maps.places.PlaceResult => ({
    formatted_address: placeDetails.formatted_address,
    address_components: placeDetails.address_components,
    geometry: placeDetails.geometry
      ? {
          location: {
            lat: () => placeDetails.geometry?.location.lat ?? 0,
            lng: () => placeDetails.geometry?.location.lng ?? 0,
          } as google.maps.LatLng,
        } as google.maps.places.PlaceGeometry
      : undefined,
    place_id: placeDetails.place_id,
  });

  const resetSessionToken = () => {
    sessionTokenRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const handlePredictionSelect = async (prediction: BackendPlacePrediction) => {
    setIsSelectingPlace(true);
    setIsOpen(false);
    setPredictions([]);

    try {
      const details = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);

      if (!details.formatted_address || !details.geometry?.location) {
        onChangeRef.current('');
        return;
      }

      const place = buildGoogleCompatiblePlace(details);
      const zip = getPostalCode(place);
      let finalAddress = details.formatted_address;

      // Google often omits ZIP from formatted_address, so append it for display/storage.
      if (zip && !finalAddress.includes(zip)) {
        finalAddress = `${finalAddress}, ${zip}`;
      }

      setLocalValue(finalAddress);

      if (inputRef.current) {
        inputRef.current.value = finalAddress;
      }

      console.log('[BACKEND PLACES AUTOCOMPLETE] place_selected', {
        finalAddress,
        googleFormattedAddress: details.formatted_address,
        placeId: details.place_id,
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

      resetSessionToken();
    } catch (error) {
      console.warn('[PLACES AUTOCOMPLETE] details failed', error);
      onChangeRef.current('');
    } finally {
      setTimeout(() => setIsSelectingPlace(false), 100);
    }
  };

  /**
   * Handle manual typing
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSelectingPlace) return;

    const typedValue = e.target.value;
    setLocalValue(typedValue);
    setIsOpen(typedValue.trim().length >= 3);
    onChange(typedValue);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%'
      }}
    >
      <input
        ref={inputRef}
        name={name}
        value={localValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (predictions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
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
      {isOpen && !disabled && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            minWidth: '280px',
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #d6d6d6',
            borderRadius: '6px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden'
          }}
        >
          {isLoadingPredictions && predictions.length === 0 ? (
            <div style={{ padding: '0.75rem', color: '#666' }}>Searching addresses...</div>
          ) : (
            predictions.map((prediction) => (
              <button
                key={prediction.placeId}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePredictionSelect(prediction)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.75rem',
                  border: 0,
                  borderBottom: '1px solid #eee',
                  background: '#fff',
                  color: '#1f2933',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <strong style={{ display: 'block' }}>
                  {prediction.structuredFormatting?.main_text || prediction.description}
                </strong>
                {prediction.structuredFormatting?.secondary_text && (
                  <span style={{ display: 'block', color: '#667085', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                    {prediction.structuredFormatting.secondary_text}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
