import { useState, useEffect } from 'react';

export function useCartSettings() {
  const [duration, setDurationState] = useState<string>("");
  const [surface, setSurfaceState] = useState<string>("");
  const [deliveryTime, setDeliveryTimeState] = useState<string>("");
  const [location, setLocationState] = useState<string>("");
  const [wetDrySelections, setWetDrySelectionsState] = useState<{[idx: number]: string}>({});
  const [giftCardValues, setGiftCardValuesState] = useState<{[idx: number]: number}>({});

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      // Only load values if they exist in localStorage (not null/empty)
      const savedDuration = localStorage.getItem("cart_duration");
      const savedSurface = localStorage.getItem("cart_surface");
      const savedDeliveryTime = localStorage.getItem("cart_deliveryTime");
      const savedLocation = localStorage.getItem("cart_location");
      
      // Only set state if values exist and are not empty
      if (savedDuration) setDurationState(savedDuration);
      if (savedSurface) setSurfaceState(savedSurface);
      if (savedDeliveryTime) setDeliveryTimeState(savedDeliveryTime);
      if (savedLocation) setLocationState(savedLocation);

      // Load wet/dry selections
      const savedWetDrySelections = localStorage.getItem("cart_wetDrySelections");
      if (savedWetDrySelections) {
        try {
          const parsedWetDry = JSON.parse(savedWetDrySelections);
          setWetDrySelectionsState(parsedWetDry);
        } catch (error) {
          console.error('🔧 useCartSettings: Error parsing wet/dry selections:', error);
        }
      }

      // Load gift card values
      const savedGiftCardValues = localStorage.getItem("cart_giftCardValues");
      if (savedGiftCardValues) {
        try {
          const parsedGiftCards = JSON.parse(savedGiftCardValues);
          setGiftCardValuesState(parsedGiftCards);
        } catch (error) {
          console.error('🔧 useCartSettings: Error parsing gift card values:', error);
        }
      }
    } catch (error) {
      console.error('🔧 useCartSettings: Error loading from localStorage:', error);
    }
  }, []);

  // Wrapper functions that immediately save to localStorage
  const setDuration = (newDuration: string) => {
    setDurationState(newDuration);
    localStorage.setItem("cart_duration", newDuration);
  };

  const setSurface = (newSurface: string) => {
    setSurfaceState(newSurface);
    localStorage.setItem("cart_surface", newSurface);
  };

  const setDeliveryTime = (newDeliveryTime: string) => {
    setDeliveryTimeState(newDeliveryTime);
    localStorage.setItem("cart_deliveryTime", newDeliveryTime);
  };

  const setLocation = (newLocation: string) => {
    setLocationState(newLocation);
    localStorage.setItem("cart_location", newLocation);
  };

  const setWetDrySelections = (newSelections: {[idx: number]: string}) => {
    setWetDrySelectionsState(newSelections);
    localStorage.setItem("cart_wetDrySelections", JSON.stringify(newSelections));
  };

  const setGiftCardValues = (newValues: {[idx: number]: number}) => {
    setGiftCardValuesState(newValues);
    localStorage.setItem("cart_giftCardValues", JSON.stringify(newValues));
  };

  return {
    duration,
    setDuration,
    surface,
    setSurface,
    deliveryTime,
    setDeliveryTime,
    location,
    setLocation,
    wetDrySelections,
    setWetDrySelections,
    giftCardValues,
    setGiftCardValues,
  };
}