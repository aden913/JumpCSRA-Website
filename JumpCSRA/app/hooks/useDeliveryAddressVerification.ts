import { useCallback, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";

type Coordinates = {
  lat: number;
  lng: number;
};

type AddressDebugSnapshot = {
  inputAddress: string;
  selectedGoogleAddress: string;
  normalizedInputAddress: string;
  normalizedSelectedGoogleAddress: string;
  addressMatchesSelection: boolean;
  selectedCoordinates: Coordinates | null;
  hasCoordinates: boolean;
  lastFailureReason: string | null;
};

const BASE_COORDINATES: Coordinates = { lat: 33.4858818054199, lng: -81.9477233886719 };

const normalizeAddress = (address: string): string => address.trim().replace(/\s+/g, " ").toLowerCase();

export function useDeliveryAddressVerification() {
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false);
  const [calculatingDistance, setCalculatingDistance] = useState<boolean>(false);
  const [failedAddresses, setFailedAddresses] = useState<Set<string>>(new Set());
  const [lastFailureReason, setLastFailureReason] = useState<string | null>(null);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const selectedPlaceCoordinatesRef = useRef<Coordinates | null>(null);
  const selectedGooglePlaceAddressRef = useRef<string>("");

  const getDebugSnapshot = useCallback((inputAddress: string): AddressDebugSnapshot => {
    const selectedGoogleAddress = selectedGooglePlaceAddressRef.current;
    const selectedCoordinates = selectedPlaceCoordinatesRef.current;
    const normalizedInputAddress = normalizeAddress(inputAddress);
    const normalizedSelectedGoogleAddress = normalizeAddress(selectedGoogleAddress);

    return {
      inputAddress,
      selectedGoogleAddress,
      normalizedInputAddress,
      normalizedSelectedGoogleAddress,
      addressMatchesSelection: normalizedInputAddress === normalizedSelectedGoogleAddress,
      selectedCoordinates,
      hasCoordinates: Boolean(selectedCoordinates),
      lastFailureReason,
    };
  }, [lastFailureReason]);

  const calculateDeliveryDistance = useCallback(async (
    destinationAddress: string,
    destinationCoordinates: Coordinates | null
  ): Promise<boolean> => {
    console.log("[DELIVERY ADDRESS] calculateDeliveryDistance", {
      destinationAddress,
      destinationCoordinates,
    });

    setCalculatingDistance(true);
    try {
      const destLat = destinationCoordinates?.lat;
      const destLon = destinationCoordinates?.lng;

      if (destLat === undefined || destLon === undefined) {
        const failureReason = "missing-google-place-coordinates";
        setLastFailureReason(failureReason);
        setFailedAddresses(prev => new Set(prev).add(destinationAddress));
        console.warn("[DELIVERY ADDRESS] Missing Google Place coordinates", getDebugSnapshot(destinationAddress));
        notifications.show({
          title: "Address Verification",
          message: "Please select a delivery address from the Google autocomplete dropdown so we can verify the exact location.",
          color: "orange",
          autoClose: 6000,
        });
        return false;
      }

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${BASE_COORDINATES.lng},${BASE_COORDINATES.lat};${destLon},${destLat}?overview=false`;
      const routeResponse = await fetch(osrmUrl);
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const distanceMeters = routeData.routes[0].distance;
        const distanceMiles = distanceMeters * 0.000621371;

        if (distanceMiles > 200) {
          const failureReason = "delivery-distance-exceeded";
          setLastFailureReason(failureReason);
          setDeliveryCost(0);
          setAddressConfirmed(false);
          setFailedAddresses(prev => new Set(prev).add(destinationAddress));
          notifications.show({
            title: "Delivery Distance Exceeded",
            message: `This address is ${Math.round(distanceMiles)} miles away. We only deliver within 200 miles of our location. Please contact us at (803) 221-0466 for special arrangements.`,
            color: "red",
            autoClose: 8000,
          });
          return false;
        }

        const cost = Math.round(distanceMiles * 6);
        setDeliveryCost(cost);
        setLastFailureReason(null);
        return true;
      }

      throw new Error("Could not calculate route");
    } catch (error) {
      const failureReason = "route-calculation-error";
      setLastFailureReason(failureReason);
      console.error("[DELIVERY ADDRESS] Delivery cost calculation error", error);
      setDeliveryCost(0);
      setAddressConfirmed(false);
      return false;
    } finally {
      setCalculatingDistance(false);
    }
  }, [getDebugSnapshot]);

  const handlePlaceSelected = useCallback((place: google.maps.places.PlaceResult, formattedAddress?: string) => {
    console.log("[DELIVERY ADDRESS] handlePlaceSelected", {
      formattedAddress,
      googleFormattedAddress: place.formatted_address,
      placeId: place.place_id,
      hasGeometry: Boolean(place.geometry?.location),
    });

    if (!place.formatted_address || !place.geometry?.location || !place.place_id) {
      setLastFailureReason("invalid-google-place-result");
      return;
    }

    const selectedAddress = formattedAddress?.trim() || addressInputRef.current?.value?.trim() || place.formatted_address || "";
    const placeCoordinates = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    selectedGooglePlaceAddressRef.current = selectedAddress;
    selectedPlaceCoordinatesRef.current = placeCoordinates;
    setLastFailureReason(null);

    setTimeout(() => {
      const addressForCalculation = addressInputRef.current?.value?.trim() || selectedAddress;
      if (addressForCalculation) {
        calculateDeliveryDistance(addressForCalculation, placeCoordinates);
      }
    }, 150);
  }, [calculateDeliveryDistance]);

  const handleAddressChange = useCallback((value: string) => {
    console.log("[DELIVERY ADDRESS] handleAddressChange", {
      value,
      previousDeliveryAddress: deliveryAddress,
      selectedGoogleAddress: selectedGooglePlaceAddressRef.current,
      hasSelectedCoordinates: Boolean(selectedPlaceCoordinatesRef.current),
    });

    if (value !== deliveryAddress) {
      setFailedAddresses(new Set());
      setDeliveryCost(0);
      setAddressConfirmed(false);
    }

    setDeliveryAddress(value);
  }, [deliveryAddress]);

  const confirmAddress = useCallback(async (): Promise<boolean> => {
    const inputValue = addressInputRef.current?.value?.trim() || "";

    if (!inputValue) {
      notifications.show({
        title: "Address Required",
        message: "Please enter a delivery address first.",
        color: "yellow",
        autoClose: 4000,
      });
      return false;
    }

    const hasNumber = /\d/.test(inputValue);
    const hasComma = inputValue.includes(",");
    const hasLetters = /[a-zA-Z]/.test(inputValue);
    const isLongEnough = inputValue.length >= 20;

    if (!hasNumber || !hasComma || !hasLetters || !isLongEnough) {
      notifications.show({
        title: "Invalid Address",
        message: "Please select a complete address from the Google autocomplete dropdown, including street number, city, and state (e.g., \"123 Main St, Augusta, GA 30901\").",
        color: "red",
        autoClose: 7000,
      });
      return false;
    }

    const debugSnapshot = getDebugSnapshot(inputValue);
    console.log("[DELIVERY ADDRESS] confirmAddress debug", debugSnapshot);
    console.table(debugSnapshot);

    const coordinatesForInput = debugSnapshot.addressMatchesSelection
      ? selectedPlaceCoordinatesRef.current
      : null;

    setDeliveryAddress(inputValue);
    localStorage.setItem("deliveryAddress", inputValue);
    setAddressConfirmed(false);

    const calculationSucceeded = await calculateDeliveryDistance(inputValue, coordinatesForInput);
    if (calculationSucceeded) {
      setAddressConfirmed(true);
    }

    return calculationSucceeded;
  }, [calculateDeliveryDistance, getDebugSnapshot]);

  return {
    deliveryAddress,
    setDeliveryAddress,
    deliveryCost,
    setDeliveryCost,
    addressConfirmed,
    setAddressConfirmed,
    calculatingDistance,
    setCalculatingDistance,
    failedAddresses,
    addressInputRef,
    handleAddressChange,
    handlePlaceSelected,
    confirmAddress,
    getDebugSnapshot,
  };
}