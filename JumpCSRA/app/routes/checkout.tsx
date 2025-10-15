import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router";
import { LocalStorageDebugger } from "../components/LocalStorageDebugger";
import { RouterNav } from "../components/RouterNav";
import { GooglePlacesAutocomplete } from "../components/GooglePlacesAutocomplete";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../components/FirebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getDatabase, ref, push, set } from "firebase/database";
import type { User as FirebaseUser } from "firebase/auth";
import type { CartItem } from "../components/CartSidebar";
import { useInflateables } from "../hooks/useInflateables";
import { useCartSettings } from "../hooks/useCartSettings";
import { useCategories } from "../hooks/useCategories";
import { notifications } from '@mantine/notifications';
import { Notifications } from '@mantine/notifications';
import { MantineProvider } from '@mantine/core';
import '@mantine/notifications/styles.css';
import '../styles/checkout-buttons.css';

// Contract interfaces
interface ContractSection {
  id: string;
  title: string;
  content: string;
  isInitialed: boolean;
  initialedAt?: string;
  isFinePrint?: boolean; // New field to identify fine print sections
}

interface ContractMetadata {
  contractId: string;
  userId: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    name: string; // Combined name for compatibility
    email: string;
  };
  orderDetails: {
    eventDate: string;
    duration: string;
    deliveryAddress: string;
    surface: string;
    deliveryTime: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
  };
  agreementSections: ContractSection[];
  signature: {
    signatureData: string;
    signedAt: string;
  } | null;
  contractDate: string;
  initials: string;
}

export function meta() {
  return [
    { title: "Checkout - Jump CSRA Party Rental" },
    { name: "description", content: "Complete your party rental order" },
  ];
}

export default function Checkout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const inflateables = useInflateables();
  const categories = useCategories(inflateables);
  
  // Cart sidebar options - use persistent cart settings
  const cartSettings = useCartSettings();
  
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Helper function to get product image from inflateables data
  const getProductImage = (productName: string): string => {
    if (!productName) {
      console.warn('getProductImage: No product name provided');
      return '/assets/inflateables/default.png';
    }
    
    const product = inflateables.find(item => 
      item.name && item.name.toLowerCase() === productName.toLowerCase()
    );
    
    if (!product) {
      console.warn(`getProductImage: Product "${productName}" not found in inflateables data`);
      return '/assets/inflateables/default.png';
    }
    
    if (!product.img) {
      console.warn(`getProductImage: Product "${productName}" has no image path`);
      return '/assets/inflateables/default.png';
    }
    
    return product.img;
  };

  // Function to remove item from cart
  const removeItemFromCart = (indexToRemove: number) => {
    const updatedCart = cart.filter((_, index) => index !== indexToRemove);
    setCart(updatedCart);
    
    // Update localStorage
    if (updatedCart.length === 0) {
      localStorage.removeItem('cart');
    } else {
      localStorage.setItem('cart', JSON.stringify(updatedCart));
    }
  };

  // Checkout-specific state
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [deliverySkipped, setDeliverySkipped] = useState<boolean>(false); // Track if delivery was skipped for dev
  const [contractSigned, setContractSigned] = useState<boolean>(false);
  const [showContract, setShowContract] = useState<boolean>(false);
  const [calculatingDistance, setCalculatingDistance] = useState<boolean>(false);
  
  // Checkout step management
  type CheckoutStep = 'order-summary' | 'delivery' | 'quick-add-totals' | 'contract' | 'payment';
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('order-summary');
  const [visitedSteps, setVisitedSteps] = useState<Set<CheckoutStep>>(new Set(['order-summary']));
  
  // Google Places validation state
  const [googlePlacesAddresses, setGooglePlacesAddresses] = useState<Set<string>>(new Set());
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [isSelectingGooglePlace, setIsSelectingGooglePlace] = useState<boolean>(false);
  
  // Last-minute additions state
  const [lastMinuteAdditions, setLastMinuteAdditions] = useState<{[key: string]: number}>({});
  const [showQuantityModal, setShowQuantityModal] = useState<string | null>(null);
  
  // Contract and signature state
  const [typedSignature, setTypedSignature] = useState<string>("");
  
  // New contract system state
  const [customerInitials, setCustomerInitials] = useState<string>("");
  const [contractSections, setContractSections] = useState<ContractSection[]>([]);
  const [contractMetadata, setContractMetadata] = useState<ContractMetadata | null>(null);
  const [showInitialsPrompt, setShowInitialsPrompt] = useState<boolean>(false);

  // Base location for distance calculation
  const BASE_LOCATION = "410 Carolina Springs Rd, North Augusta, SC 29841";

  // Checkout step management functions
  const stepOrder: CheckoutStep[] = ['order-summary', 'delivery', 'quick-add-totals', 'contract', 'payment'];
  const stepTitles = {
    'order-summary': 'Order Summary',
    'delivery': 'Delivery Information',
    'quick-add-totals': 'Quick Add & Order Total',
    'contract': 'Sign Contract',
    'payment': 'Payment'
  };

  const goToNextStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      // Validate current step before allowing progression
      if (canProceedFromCurrentStep()) {
        const nextStep = stepOrder[currentIndex + 1];
        setCurrentStep(nextStep);
        // Track that this step has been visited
        setVisitedSteps(prev => new Set([...prev, nextStep]));
      }
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  // Validation functions for step progression
  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case 'order-summary':
        return cart.length > 0; // Must have items in cart
      case 'delivery':
        // If delivery is skipped for development, don't require address validation
        if (deliverySkipped) return true;
        return deliveryAddress.trim() !== '' && deliveryCost > 0;
      case 'quick-add-totals':
        // If delivery is skipped for development, don't require address validation
        if (deliverySkipped) return cart.length > 0;
        return cart.length > 0 && deliveryAddress.trim() !== '' && deliveryCost > 0;
      case 'contract':
        return false; // Contract step should use its own signing logic, not goToNextStep
      default:
        return true;
    }
  };

  const getNextStepButtonText = () => {
    switch (currentStep) {
      case 'order-summary':
        return 'Continue to Delivery';
      case 'delivery':
        return 'Continue to Order Review';
      case 'quick-add-totals':
        return 'Proceed to Contract';
      default:
        return 'Next';
    }
  };

  const canShowNextButton = () => {
    const result = (() => {
      switch (currentStep) {
        case 'order-summary':
          return cart.length > 0;
        case 'delivery':
          // If delivery is skipped for development, don't require address validation
          if (deliverySkipped) return true;
          return deliveryAddress.trim() !== '' && deliveryCost > 0;
        case 'quick-add-totals':
          // If delivery is skipped for development, don't require address validation
          if (deliverySkipped) return cart.length > 0;
          return cart.length > 0 && deliveryAddress.trim() !== '' && deliveryCost > 0;
        default:
          return false;
      }
    })();
    
    // Debug logging
    if (currentStep === 'delivery') {
      console.log('canShowNextButton DEBUG:', {
        currentStep,
        deliveryAddress: deliveryAddress.trim(),
        deliveryCost,
        deliverySkipped,
        result
      });
    }
    
    return result;
  };

  // Generate contract sections based on cart items
  const generateContractSections = (): ContractSection[] => {
    const sections: ContractSection[] = [];
    
    // Generate rental items list
    const rentalItems = cart.map(item => {
      const inflatable = inflateables.find(inf => inf.name === item.name);
      const wetDryText = item.wetDry ? ` - ${item.wetDry}` : '';
      const surfaceText = cartSettings.surface ? ` - ${cartSettings.surface}` : '';
      return `${item.name} - ${cartSettings.duration}${wetDryText}${surfaceText}`;
    }).join('\n');
    
    // Generate requirements list based on cart items
    const requirements = [];
    
    // Check if there are inflatables that need power
    const hasInflatables = cart.some(item => 
      inflateables.find(inf => inf.name === item.name && 
        (inf.category === 'Bounce Houses' || inf.category === 'Water Slides' || inf.category === 'Combo Units'))
    );
    
    if (hasInflatables) {
      requirements.push('Provide 110volt/20amp electric circuits within 75ft, or provide / rent a generator.');
      requirements.push('Provide any required entrance and parking passes for access to rental delivery.');
      requirements.push('Provide at least 1 adult volunteer(s) for each inflatable to ensure safety for the participants.');
      requirements.push('Ensure Jumpers remove shoes, eyeglasses, and any sharp objects before jumping.');
      requirements.push('Be held financially responsible for damage done to the rental.');
      requirements.push('Ensure jumpers go down the slide feet first, one rider at a time per lane.');
      requirements.push('In the event of high wind, rain, or storm, ensure all participants get off of the unit and move the blower out of the rain.');
      requirements.push('Ensure there is no jumping or climbing on the outside of the inflatable or security netting.');
    }
    
    // Check for water rentals by looking at both the 'wet' property and user's wetDry selection
    const hasWaterRentals = cart.some(item => {
      const inflatable = inflateables.find(inf => inf.name === item.name);
      // Check if the inflatable can be wet AND the user selected wet mode
      return inflatable?.wet === true && item.wetDry === 'Wet';
    });
    
    // Get customer info
    const customerName = userProfile?.firstName && userProfile?.lastName 
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : userProfile?.name || user?.displayName || user?.email || '';
    
    // First section: Rental Agreement Between Parties
    sections.push({
      id: 'rental-agreement',
      title: 'Rental Contract & Terms Between',
      content: `${customerName}\n${deliveryAddress}\n\nand\n\nJump CSRA Party Rental\n\nI agree to rent the following items from ${calendarDateRange[0]?.toLocaleDateString()} ${cartSettings.deliveryTime} until ${calendarDateRange[1]?.toLocaleDateString()} 12:00pm:\n\n${rentalItems}\n\n${requirements.join('\n')}`,
      isInitialed: false
    });

    // Water Rental Agreement (only if water items are rented)
    if (hasWaterRentals) {
      sections.push({
        id: 'water-agreement',
        title: 'Water Rental Agreement',
        content: 'I understand and agree to the following water rental requirements:\n\n• Provide a water hose that reaches to the water rental or add one to my order.\n• Ensure the inflatable is properly drained and dried before pickup.\n• Water usage is the responsibility of the renter and may affect utility costs.\n• In case of inclement weather, water activities must cease immediately for safety.\n• Adult supervision is required at all times during water activities.\n• Maximum occupancy limits must be strictly followed for water units.',
        isInitialed: false
      });
    }

    // Standard agreement sections (always included)
    sections.push({
      id: 'security-deposit',
      title: 'Security Deposit',
      content: 'I understand a $50 deposit will be placed on my card and may be charged after pickup if: Food, candy, drinks, pets, water balloons, silly string, soap, paint, or other messes are found. The unit is muddy, full of water, unclean, or not inflated at pickup. The unit is not in the same condition it was at delivery. There is excess amounts of water left in the unit. The unit is not inflated by 8:00am on pick up day to dry out. The unit is not inflated when we arrive for pick up.',
      isInitialed: false
    });
    
    sections.push({
      id: 'safety-usage',
      title: 'Safety & Usage',
      content: 'I agree that: The inflatable will not be moved or repositioned after setup. All users will remove shoes, glasses, and sharp objects before entering. The inflatable will stay inflated during rain, but deflated when high winds are present.',
      isInitialed: false
    });
    
    sections.push({
      id: 'cancellation-policy',
      title: 'Cancellation Policy',
      content: 'I agree to the cancellation policy as follows. Cancel 14+ days before your event: Receive a full refund. Cancel within 6–13 days of your event: Receive a gift card for 100%, which can be used for any future rental—no expiration date. Cancel with less than 5 days\' notice: Receive a gift card for 50%. The remaining 50% is non-refundable. If Jump CSRA cancels due to weather (e.g., storms, high winds, heavy rain): You will receive a full refund.',
      isInitialed: false
    });
    
    sections.push({
      id: 'hold-harmless',
      title: 'Hold Harmless Provision',
      content: 'Lessee recognizes and understands that the use of Lessor equipment may involve inherently dangerous activities. Consequently, lessee agrees to indemnify and hold lessor harmless from any and all claims, actions, suits, proceeding costs, expenses, damages, and liabilities, including reasonable attorney\'s fees arising by reason of injury, damage, or death to persons or property, in connection with or resulting from the use of said equipment including, but not limited to the delivery, possession, use, operation, or return of the equipment. Lessee hereby releases and holds harmless lessor from injuries or damages incurred as a result of the use of said equipment unless the lessor is operating the equipment and is deemed by a court of law to be negligent in its actions. Lessor cannot under any circumstances be held liable for injuries as a result of acts of God, nature, or other conditions beyond its control or knowledge. Lessee also agrees to indemnify and hold harmless lessor from any loss, damage, theft, or destruction of the equipment during the term of this contract and any extension thereof.',
      isInitialed: false,
      isFinePrint: true
    });
    
    sections.push({
      id: 'merger-clause',
      title: 'Merger Clause',
      content: 'This signed Agreement in conjunction with the signed Instruction Manual and Reservation Form contains the entire agreement between the Lessor and the Lessee. No amendment, whether from previous or subsequent negotiations between the Lessee and the Lessor, shall be valid or enforceable unless in writing and signed by all parties to this contract. The invalidity or unenforceability of any particular provision of this Agreement shall not affect the other provisions hereof.',
      isInitialed: false,
      isFinePrint: true
    });
    
    return sections;
  };

  // Track deliveryAddress state changes for debugging
  useEffect(() => {
    console.log('🔄 DELIVERY ADDRESS STATE CHANGED:', deliveryAddress);
  }, [deliveryAddress]);

  // Initialize contract sections when entering contract step
  useEffect(() => {
    if (currentStep === 'contract' && contractSections.length === 0) {
      const sections = generateContractSections();
      setContractSections(sections);
      
      // Automatically set initials from user's firstName and lastName
      if (!customerInitials.trim() && userProfile?.firstName && userProfile?.lastName) {
        const autoInitials = `${userProfile.firstName.charAt(0).toUpperCase()}${userProfile.lastName.charAt(0).toUpperCase()}`;
        setCustomerInitials(autoInitials);
      }
      
      // Automatically set signature from user's full name
      if (!typedSignature.trim() && userProfile?.firstName && userProfile?.lastName) {
        const fullName = `${userProfile.firstName} ${userProfile.lastName}`;
        setTypedSignature(fullName);
      }
    }
  }, [currentStep, contractSections.length, customerInitials, typedSignature, userProfile]);

  // Handle section initialing
  const handleSectionInitial = (sectionId: string) => {
    // Automatically generate initials from user's firstName and lastName
    const autoInitials = userProfile?.firstName && userProfile?.lastName 
      ? `${userProfile.firstName.charAt(0).toUpperCase()}${userProfile.lastName.charAt(0).toUpperCase()}`
      : customerInitials.trim() || 'XX'; // Fallback to existing initials or XX
    
    // Set the initials if not already set
    if (!customerInitials.trim()) {
      setCustomerInitials(autoInitials);
    }
    
    setContractSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, isInitialed: !section.isInitialed, initialedAt: new Date().toISOString() }
          : section
      )
    );
  };

  // Check if all sections are initialed (excluding fine print)
  const allSectionsInitialed = () => {
    const sectionsRequiringInitials = contractSections.filter(section => !section.isFinePrint);
    return sectionsRequiringInitials.length > 0 && sectionsRequiringInitials.every(section => section.isInitialed);
  };

  // Handle contract completion
  const handleContractCompletion = async () => {
    if (!allSectionsInitialed() || !typedSignature.trim()) {
      alert("Please initial all sections and provide your signature before proceeding.");
      return;
    }
    
    try {
      const contractId = await saveContractMetadata();
      if (contractId) {
        setContractSigned(true);
        alert("Contract signed and saved successfully!");
        goToNextStep();
      } else {
        alert("Error saving contract. Please try again.");
      }
    } catch (error) {
      console.error("Error completing contract:", error);
      alert("Error saving contract. Please try again.");
    }
  };

  // Calculate driving distance using OSRM (free routing service)
  const calculateDeliveryDistance = async (destinationAddress: string) => {
    console.log('🚚 DELIVERY COST CALCULATION STARTED:');
    console.log('  - Function called with destinationAddress:', destinationAddress);
    console.log('  - Current deliveryAddress state:', deliveryAddress);
    console.log('  - Current input field value:', addressInputRef.current?.value);
    console.log('  - Base location:', BASE_LOCATION);
    console.log('  - Known Google Places addresses:', Array.from(googlePlacesAddresses));
    
    setCalculatingDistance(true);
    try {
      // First, geocode both addresses
      console.log('  📍 GEOCODING STEP:');
      console.log('    - Base location for geocoding:', BASE_LOCATION);
      console.log('    - Destination address for geocoding:', destinationAddress);
      console.log('    - Base geocoding URL:', `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`);
      console.log('    - Destination geocoding URL:', `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`);
      
      const [baseResponse, destResponse] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`)
      ]);

      const [baseData, destData] = await Promise.all([
        baseResponse.json(),
        destResponse.json()
      ]);
      
      console.log('    - Base geocoding results:', baseData);
      console.log('    - Destination geocoding results:', destData);
      console.log('    - Base results count:', baseData.length, '| Destination results count:', destData.length);

      if (baseData.length === 0 || destData.length === 0) {
        throw new Error("Could not find one or both addresses");
      }

      const baseLat = parseFloat(baseData[0].lat);
      const baseLon = parseFloat(baseData[0].lon);
      const destLat = parseFloat(destData[0].lat);
      const destLon = parseFloat(destData[0].lon);

      console.log('  📍 COORDINATE EXTRACTION:');
      console.log('    - Base coordinates:', { lat: baseLat, lon: baseLon });
      console.log('    - Destination coordinates:', { lat: destLat, lon: destLon });
      console.log('    - Base location name:', baseData[0].display_name);
      console.log('    - Destination location name:', destData[0].display_name);

      // Use OSRM API for driving distance calculation
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${baseLon},${baseLat};${destLon},${destLat}?overview=false`;
      console.log('  🛣️  OSRM ROUTING REQUEST:');
      console.log('    - OSRM URL:', osrmUrl);
      
      const routeResponse = await fetch(osrmUrl);
      const routeData = await routeResponse.json();

      console.log('    - OSRM response status:', routeResponse.status);
      console.log('    - OSRM route data:', routeData);
      console.log('    - Number of routes found:', routeData.routes?.length || 0);

      if (routeData.routes && routeData.routes.length > 0) {
        const distanceMeters = routeData.routes[0].distance;
        const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles
        const cost = Math.round(distanceMiles * 6); // $6 per mile, rounded
        
        console.log('  💰 COST CALCULATION:');
        console.log('    - Distance in meters:', distanceMeters);
        console.log('    - Distance in miles:', distanceMiles.toFixed(2));
        console.log('    - Rate per mile: $6');
        console.log('    - Raw cost calculation:', distanceMiles * 6);
        console.log('    - Final rounded cost: $' + cost);
        console.log('    - Address used for calculation:', destinationAddress);
        console.log('    - Is this a Google Places address?:', googlePlacesAddresses.has(destinationAddress));
        
        setDeliveryCost(cost);
        notifications.show({
          title: '🚚 Delivery Cost Calculated',
          message: `Distance: ${distanceMiles.toFixed(1)} miles • Cost: $${cost}`,
          color: 'blue',
          autoClose: 5000,
        });
      } else {
        throw new Error("Could not calculate route");
      }
    } catch (error) {
      console.error('❌ DELIVERY COST CALCULATION ERROR:', error);
      console.log('  - Failed with address:', destinationAddress);
      console.log('  - Current deliveryAddress state:', deliveryAddress);
      console.log('  - Current input field value:', addressInputRef.current?.value);
      notifications.show({
        title: '❌ Delivery Calculation Error',
        message: 'Could not calculate delivery distance. Please verify the address and try again.',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      console.log('🏁 DELIVERY COST CALCULATION FINISHED');
      setCalculatingDistance(false);
    }
  };

  // Handle Google Places address selection
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    // Only accept valid places with formatted address and location
    if (place.formatted_address && place.geometry?.location && place.place_id) {
      const googleAddress = place.formatted_address;
      
      console.log('🎯 GOOGLE PLACES SELECTION:');
      console.log('  - Raw place object:', place);
      console.log('  - Formatted address from Google:', googleAddress);
      console.log('  - Current input field value:', addressInputRef.current?.value);
      console.log('  - Current deliveryAddress state:', deliveryAddress);
      
      // Set flag to prevent manual input from overriding this selection
      setIsSelectingGooglePlace(true);
      
      // Add this address to our set of valid Google Places addresses
      setGooglePlacesAddresses(prev => new Set(prev).add(googleAddress));
      
      // Update delivery address with the Google address using flushSync for immediate update
      flushSync(() => {
        setDeliveryAddress(googleAddress);
      });
      
      // Also update the input field directly to ensure it shows the Google address
      if (addressInputRef.current) {
        addressInputRef.current.value = googleAddress;
      }
      
      console.log('  - Called setDeliveryAddress with flushSync:', googleAddress);
      console.log('  - Updated input field to:', googleAddress);
      console.log('  - Immediate deliveryAddress state is now:', deliveryAddress);
      
      // Double-check that the state was updated properly
      if (deliveryAddress !== googleAddress) {
        console.warn('  - WARNING: State did not update immediately!');
        console.log('  - Expected:', googleAddress);
        console.log('  - Actual:', deliveryAddress);
        // Try setting it again as fallback
        setDeliveryAddress(googleAddress);
      }
      
      // Clear the flag after a short delay
      setTimeout(() => {
        setIsSelectingGooglePlace(false);
      }, 100);
      
      // Automatically calculate distance when a place is selected
      calculateDeliveryDistance(googleAddress);
    }
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    console.log('📝 MANUAL ADDRESS CHANGE:');
    console.log('  - Typed value:', value);
    console.log('  - Previous deliveryAddress state:', deliveryAddress);
    console.log('  - Current input field value:', addressInputRef.current?.value);
    console.log('  - Is currently selecting Google Place?:', isSelectingGooglePlace);
    
    // Don't override if we're currently selecting a Google Place
    if (isSelectingGooglePlace) {
      console.log('  - BLOCKED: Google Place selection in progress, ignoring manual change');
      return;
    }
    
    setDeliveryAddress(value);
    
    console.log('  - Updated deliveryAddress to:', value);
  };

  // Authentication guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // User not logged in, redirect to login
        navigate("/");
        return;
      }
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
    };

    loadUserProfile();
  }, [user]);


  // Load cart and settings from localStorage
  useEffect(() => {
    if (!loading && user) {
      // Load cart from localStorage
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (error) {
          console.error("Error parsing cart from localStorage:", error);
          setCart([]);
        }
      }
      
      // Load calendar date range from localStorage
      const savedDateRange = localStorage.getItem("calendarDateRange");
      if (savedDateRange) {
        try {
          const parsed = JSON.parse(savedDateRange);
          const range: [Date | null, Date | null] = [
            parsed[0] ? new Date(parsed[0]) : null,
            parsed[1] ? new Date(parsed[1]) : null,
          ];
          setCalendarDateRange(range);
        } catch (error) {
          console.error("Error parsing date range from localStorage:", error);
        }
      }
    }
  }, [loading, user]);

  // Pricing calculations (copied from CartSidebar logic)
  const surfacePrices: Record<string, number> = {
    "grass-stakes": 0,
    "grass-sandbags": 50,
    "concrete": 50,
    "indoor": 40,
  };
  
  const timePrices: Record<string, number> = {
    "8am": 50,
    "9am": 40,
    "10am": 30,
    "11am": 20,
    "12pm": 10,
    "": 0,
  };
  
  const durationMultipliers: Record<string, number> = {
    "4hours": 0.9,  // 10% discount
    "24hours": 1.0, // Base price
    "48hours": 1.5, // 50% increase
  };

  // Calculate cart total including last-minute additions
  const durationMultiplier = cartSettings.duration ? durationMultipliers[cartSettings.duration] || 1.0 : 1.0;
  const cartTotal = cart.reduce((sum, item) => {
    if (item.isGiftCard) {
      return sum + (item.giftCardValue || item.price) * item.quantity;
    } else {
      return sum + item.price * item.quantity * durationMultiplier;
    }
  }, 0);

  // Calculate last-minute additions total
  const lastMinuteTotal = Object.entries(lastMinuteAdditions).reduce((sum, [itemName, quantity]) => {
    if (quantity === 0) return sum;
    const item = partyEssentials.find(p => p.name === itemName);
    if (item) {
      const isWeekend = calendarDateRange[0] && calendarDateRange[0].getDay() === 0 || calendarDateRange[0]?.getDay() === 6;
      const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
      return sum + (price * quantity * durationMultiplier);
    }
    return sum;
  }, 0);
  
  const surfaceAdj = cartSettings.surface ? surfacePrices[cartSettings.surface] || 0 : 0;
  const timeAdj = cartSettings.deliveryTime ? timePrices[cartSettings.deliveryTime] || 0 : 0;
  const subtotal = cartTotal + lastMinuteTotal + surfaceAdj + timeAdj;
  const total = subtotal + deliveryCost;

  // Get party essentials for carousel
  const partyEssentials = inflateables.filter(item => 
    item.category && item.category.toLowerCase() === "party-essentials" && 
    !item.isGiftCard // Exclude gift cards from last-minute additions
  );

  // Add item to last-minute additions
  const handleAddLastMinuteItem = (itemName: string, quantity: number) => {
    setLastMinuteAdditions(prev => ({
      ...prev,
      [itemName]: quantity
    }));
    setShowQuantityModal(null);
  };

  // Signature handling functions
  const handleSignatureClick = () => {
    // Auto-populate with user's full name if available
    if (!typedSignature.trim() && userProfile?.firstName && userProfile?.lastName) {
      const fullName = `${userProfile.firstName} ${userProfile.lastName}`;
      setTypedSignature(fullName);
    }
  };

  const clearSignature = () => {
    setTypedSignature("");
  };

  // Save signed contract to database
  // Save contract metadata to Firebase Realtime Database
  const saveContractMetadata = async (): Promise<string | null> => {
    if (!user || !allSectionsInitialed() || !typedSignature.trim() || !customerInitials.trim()) {
      console.error("Missing required contract data");
      return null;
    }

    try {
      // Fetch user profile data to get firstName and lastName
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      
      // Extract firstName and lastName, with fallbacks
      let firstName = userData?.firstName || "";
      let lastName = userData?.lastName || "";
      let fullName = userData?.name || user.displayName || "";
      
      // If we don't have firstName/lastName but have a full name, split it
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.split(' ');
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(' ') || "";
      }
      
      // If we have firstName/lastName but no full name, combine them
      if ((firstName || lastName) && !fullName) {
        fullName = `${firstName} ${lastName}`.trim();
      }

      const database = getDatabase();
      const contractsRef = ref(database, 'contracts');
      const newContractRef = push(contractsRef);
      
      const contractMetadata: ContractMetadata = {
        contractId: newContractRef.key || `contract_${user.uid}_${Date.now()}`,
        userId: user.uid,
        customerInfo: {
          firstName,
          lastName,
          name: fullName,
          email: user.email || ""
        },
        orderDetails: {
          eventDate: `${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}`,
          duration: cartSettings.duration,
          deliveryAddress: deliveryAddress,
          surface: cartSettings.surface,
          deliveryTime: cartSettings.deliveryTime,
          items: [
            ...cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.isGiftCard ? (item.giftCardValue || item.price) : item.price
            })),
            ...Object.entries(lastMinuteAdditions)
              .filter(([_, quantity]) => quantity > 0)
              .map(([itemName, quantity]) => {
                const item = partyEssentials.find(p => p.name === itemName);
                const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                const price = item ? (isWeekend ? item.weekendPrice : item.weekdayPrice) : 0;
                return { name: itemName, quantity, price };
              })
          ],
          totalAmount: total
        },
        agreementSections: contractSections,
        signature: {
          signatureData: typedSignature,
          signedAt: new Date().toISOString()
        },
        contractDate: new Date().toLocaleDateString(),
        initials: customerInitials
      };

      await set(newContractRef, contractMetadata);
      setContractMetadata(contractMetadata);
      
      console.log("Contract metadata saved successfully:", contractMetadata.contractId);
      return contractMetadata.contractId;
    } catch (error) {
      console.error("Error saving contract metadata:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        Loading checkout...
      </div>
    );
  }

  // If cart is empty, redirect back to home
  if (cart.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '1rem'
      }}>
        <h2>Your cart is empty</h2>
        <button id="btn-continue-shopping" onClick={() => navigate("/home")}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <>
      <MantineProvider>
        <Notifications position="top-right" />
        <LocalStorageDebugger />
        <RouterNav
        categories={categories}
        onCategoryChange={() => {}} // No-op on checkout page since we don't filter products here
      />
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh'
      }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#333' }}>
        Complete Your Order
      </h1>

      {/* Progress Indicator */}
      <div style={{
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {stepOrder.map((step, index) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: stepOrder.indexOf(currentStep) >= index ? '#007bff' : '#e9ecef',
                color: stepOrder.indexOf(currentStep) >= index ? 'white' : '#6c757d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {index + 1}
              </div>
              <span style={{ 
                marginLeft: '0.5rem', 
                fontSize: '14px',
                color: stepOrder.indexOf(currentStep) >= index ? '#007bff' : '#6c757d',
                fontWeight: currentStep === step ? 'bold' : 'normal'
              }}>
                {stepTitles[step]}
              </span>
              {index < stepOrder.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: stepOrder.indexOf(currentStep) > index ? '#007bff' : '#e9ecef',
                  margin: '0 1rem'
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'order-summary' && (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>Order Summary</h2>
        
        {/* Cart Items */}
        <div style={{ marginBottom: '1rem' }}>
          <h3>Items:</h3>
          {cart.map((item, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'space-between', 
              padding: '0.75rem 0',
              borderBottom: '1px solid #eee'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {/* Product Image */}
                <img 
                  src={getProductImage(item.name)} 
                  alt={item.name}
                  style={{
                    width: '50px',
                    height: '50px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginRight: '1rem',
                    border: '1px solid #ddd'
                  }}
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.src = '/assets/inflateables/default.png';
                  }}
                />
                
                {/* Product Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Quantity: {item.quantity}
                    {item.isGiftCard ? ` ($${item.giftCardValue || item.price} each)` : ` (${item.wetDry})`}
                  </div>
                </div>
              </div>
              
              {/* Price and Remove Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  ${item.isGiftCard 
                    ? ((item.giftCardValue || item.price) * item.quantity).toFixed(2)
                    : (item.price * item.quantity * durationMultiplier).toFixed(2)
                  }
                </div>
                <button
                  id={`btn-remove-item-${idx}`}
                  className="btn-remove-item"
                  onClick={() => removeItemFromCart(idx)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Event Details */}
        <div style={{ marginBottom: '1rem' }}>
          <h3>Event Details:</h3>
          <p><strong>Date:</strong> {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}</p>
          <p><strong>Duration:</strong> {cartSettings.duration}</p>
          <p><strong>Surface:</strong> {cartSettings.surface}</p>
          <p><strong>Delivery Time:</strong> {cartSettings.deliveryTime}</p>
          <p><strong>Location Type:</strong> {cartSettings.location}</p>
        </div>

        {/* Pricing Breakdown */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cart Subtotal:</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          {surfaceAdj > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Surface Adjustment:</span>
              <span>${surfaceAdj.toFixed(2)}</span>
            </div>
          )}
          {timeAdj > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Time Adjustment:</span>
              <span>${timeAdj.toFixed(2)}</span>
            </div>
          )}
          {deliveryCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery Cost:</span>
              <span>${deliveryCost.toFixed(2)}</span>
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontWeight: 'bold', 
            fontSize: '1.2rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #ddd'
          }}>
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Continue to Delivery Button */}
        <div className="checkout-main-button-container">
          <button
            id="btn-main-flow"
            onClick={goToNextStep}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {currentStep === 'delivery' && (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>Delivery Address</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Enter the address where you want your rental items delivered. 
          Delivery cost is $6 per mile from our location in North Augusta, SC.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <GooglePlacesAutocomplete
            value={deliveryAddress}
            onChange={handleAddressChange}
            onPlaceSelected={handlePlaceSelected}
            placeholder="Select delivery address from Google Places suggestions"
            inputRef={addressInputRef}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <button
          id="btn-calculate-distance"
          onClick={() => {
            const inputValue = addressInputRef.current?.value?.trim();
            if (inputValue) {
              console.log('🔄 CALCULATE BUTTON CLICKED:');
              console.log('  - Input field value:', inputValue);
              console.log('  - Current deliveryAddress state:', deliveryAddress);
              
              // Update deliveryAddress state to match input field content
              flushSync(() => {
                setDeliveryAddress(inputValue);
              });
              
              console.log('  - Updated deliveryAddress to:', inputValue);
              
              // If this looks like a Google Places address, add it to the validation set
              const looksLikeGooglePlaces = inputValue.includes(',') && 
                (inputValue.toUpperCase().includes('USA') || 
                 inputValue.toUpperCase().includes('UNITED STATES') || 
                 /,\s*[A-Z]{2}[\s,]/.test(inputValue));
              
              if (looksLikeGooglePlaces) {
                setGooglePlacesAddresses(prev => new Set(prev).add(inputValue));
                console.log('  - Added to Google Places addresses:', inputValue);
              }
              
              calculateDeliveryDistance(inputValue);
            } else {
              notifications.show({
                title: '📍 Address Required',
                message: 'Please enter a delivery address first.',
                color: 'yellow',
                autoClose: 4000,
              });
            }
          }}
          disabled={calculatingDistance || !deliveryAddress.trim()}
        >
          {calculatingDistance ? 'Calculating...' : 'Calculate Delivery Cost'}
        </button>
        
        {/* Development Skip Button */}
        <button
          id="btn-skip-delivery"
          onClick={() => {
            console.log('🚀 SKIPPING DELIVERY CALCULATION FOR DEVELOPMENT');
            console.log('Before skip - deliverySkipped:', deliverySkipped);
            console.log('Before skip - deliveryCost:', deliveryCost);
            console.log('Before skip - canShowNextButton():', canShowNextButton());
            
            setDeliveryCost(0);
            setDeliverySkipped(true); // Mark delivery as skipped
            setCalculatingDistance(false);
            
            // Use setTimeout to check state after React updates
            setTimeout(() => {
              console.log('After skip - deliverySkipped should be true');
              console.log('After skip - deliveryCost:', deliveryCost);
            }, 100);
            
            notifications.show({
              title: '🚀 Development Mode',
              message: 'Delivery calculation skipped - you can now proceed to next step',
              color: 'blue',
              autoClose: 3000,
            });
          }}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: '1rem',
            fontSize: '0.9rem'
          }}
        >
          Skip Delivery (Dev)
        </button>
        
        {deliveryCost > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#e8f5e8',
            border: '1px solid #4caf50',
            borderRadius: '4px'
          }}>
            <strong>Delivery Cost Calculated: ${deliveryCost}</strong>
            <br />
            <small style={{ color: '#666' }}>
              This cost has been added to your total below.
            </small>
          </div>
        )}
        
        {/* Navigation Buttons */}
        <div className="checkout-navigation-buttons">
          <button
            id="btn-back-order-summary"
            onClick={goToPreviousStep}
          >
            Back to Order Summary
          </button>
          <button
            id="btn-forward-delivery"
            onClick={goToNextStep}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {currentStep === 'quick-add-totals' && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Add Party Essentials</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Need any last-minute additions? Add party essentials to complete your event setup.
          </p>
          
          {/* Party Essentials Carousel */}
          <div style={{ 
            display: 'flex', 
            overflowX: 'auto', 
            gap: '1rem', 
            padding: '1rem 0',
            scrollBehavior: 'smooth'
          }}>
            {partyEssentials.map((item) => {
              const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
              const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
              const currentQuantity = lastMinuteAdditions[item.name] || 0;
              
              return (
                <div
                  key={item.name}
                  style={{
                    minWidth: '200px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    textAlign: 'center',
                    backgroundColor: currentQuantity > 0 ? '#e8f5e8' : 'white'
                  }}
                >
                  <img 
                    src={item.img} 
                    alt={item.name}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}
                  />
                  <h4 style={{ margin: '0.5rem 0', fontSize: '1rem' }}>{item.name}</h4>
                  <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>
                    ${price}/each
                  </p>
                  
                  {currentQuantity > 0 ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p style={{ 
                        color: '#28a745', 
                        fontWeight: 'bold', 
                        margin: '0.25rem 0',
                        fontSize: '0.9rem'
                      }}>
                        Added: {currentQuantity} x ${price} = ${(currentQuantity * price * durationMultiplier).toFixed(2)}
                      </p>
                      <button
                        id={`btn-change-qty-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                        className="btn-change-qty"
                        onClick={() => setShowQuantityModal(item.name)}
                      >
                        Change Qty
                      </button>
                      <button
                        id={`btn-remove-last-minute-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                        className="btn-remove-last-minute"
                        onClick={() => handleAddLastMinuteItem(item.name, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      id={`btn-add-to-order-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                      className="btn-add-to-order"
                      onClick={() => setShowQuantityModal(item.name)}
                    >
                      Add to Order
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Last-minute additions summary */}
          {Object.values(lastMinuteAdditions).some(qty => qty > 0) && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Added Essentials:</h4>
              {Object.entries(lastMinuteAdditions)
                .filter(([_, quantity]) => quantity > 0)
                .map(([itemName, quantity]) => {
                  const item = partyEssentials.find(p => p.name === itemName);
                  if (!item) return null;
                  const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                  const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
                  return (
                    <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.25rem 0' }}>
                      <span>{itemName} x{quantity}</span>
                      <span>${(quantity * price * durationMultiplier).toFixed(2)}</span>
                    </div>
                  );
                })
              }
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 'bold',
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #dee2e6'
              }}>
                <span>Essentials Total:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        )}
        
        {/* Navigation Buttons */}
        {(deliveryCost > 0 || Object.values(lastMinuteAdditions).some(qty => qty > 0)) && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '2rem', 
            borderRadius: '8px', 
            marginBottom: '2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '1rem', color: '#333' }}>Updated Order Total</h2>
          
          {/* Pricing Breakdown */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Original Cart:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            {lastMinuteTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Party Essentials:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            )}
            {surfaceAdj > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Surface Adjustment:</span>
                <span>${surfaceAdj.toFixed(2)}</span>
              </div>
            )}
            {timeAdj > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Time Adjustment:</span>
                <span>${timeAdj.toFixed(2)}</span>
              </div>
            )}
            {deliveryCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Delivery Cost:</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontWeight: 'bold', 
              fontSize: '1.2rem',
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '2px solid #ddd'
            }}>
              <span>Final Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        )}
        
        {/* Navigation Buttons - Only show after visiting this step */}
        {visitedSteps.has('quick-add-totals') && (
          <div className="checkout-navigation-buttons">
            <button
              id="btn-back-delivery"
              onClick={goToPreviousStep}
            >
              Back to Delivery
            </button>
            <button
              id="btn-forward-quick-add"
              onClick={goToNextStep}
              disabled={!canShowNextButton()}
            >
              {getNextStepButtonText()}
            </button>
          </div>
        )}
        </div>

      {currentStep === 'contract' && (
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto', 
          padding: '2rem',
          backgroundColor: 'white',
          boxShadow: '0 0 10px rgba(0,0,0,0.1)',
          fontFamily: 'Times, serif',
          lineHeight: '1.6'
        }}>
          {/* Contract Header */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '2rem',
            borderBottom: '2px solid #000',
            paddingBottom: '1rem'
          }}>
            <h1 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1.8rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              JUMP CSRA PARTY RENTAL AGREEMENT
            </h1>
            <p style={{ margin: 0, fontSize: '1rem', color: '#666' }}>
              Rental Equipment Lease Agreement and Terms of Service
            </p>
          </div>

          {/* Contract Details */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #ddd'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
              <div>
                <p style={{ margin: '0.25rem 0' }}><strong>Agreement Date:</strong> {new Date().toLocaleDateString()}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Customer:</strong> {
                  userProfile?.firstName && userProfile?.lastName 
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : userProfile?.name || user?.displayName || user?.email
                }</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Email:</strong> {user?.email}</p>
              </div>
              <div>
                <p style={{ margin: '0.25rem 0' }}><strong>Event Date:</strong> {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Delivery Address:</strong> {deliveryAddress}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Total Amount:</strong> ${total.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Main Agreement Terms */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.3rem',
              textAlign: 'center',
              textTransform: 'uppercase',
              borderBottom: '1px solid #ccc',
              paddingBottom: '0.5rem'
            }}>
              Terms and Conditions
            </h3>
            
            <p style={{ marginBottom: '1.5rem', fontStyle: 'italic', textAlign: 'center', color: '#666' }}>
              By initialing each section below, the Customer acknowledges understanding and agreement to these terms:
            </p>

            {contractSections.filter(section => !section.isFinePrint).map((section, index) => (
              <div key={section.id} style={{ 
                marginBottom: '1.5rem',
                padding: '1rem',
                border: section.isInitialed ? '2px solid #28a745' : '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: section.isInitialed ? '#f8fff8' : '#fff',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ 
                    minWidth: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: '0.5rem'
                  }}>
                    <label style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      cursor: 'pointer',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={section.isInitialed}
                        onChange={() => handleSectionInitial(section.id)}
                        style={{ 
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ 
                        display: 'inline-block',
                        minWidth: '50px',
                        padding: '0.25rem 0.5rem',
                        border: '2px solid #000',
                        borderRadius: '0px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        backgroundColor: section.isInitialed ? '#e8f5e8' : '#fff',
                        textAlign: 'center',
                        fontFamily: 'Times, serif'
                      }}>
                        {section.isInitialed ? customerInitials : '____'}
                      </div>
                    </label>
                    <small style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>Initial</small>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ 
                      margin: '0 0 0.5rem 0', 
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      color: '#333'
                    }}>
                      {index + 1}. {section.title}
                    </h4>
                    <p style={{ 
                      margin: 0, 
                      color: '#333', 
                      lineHeight: '1.5',
                      fontSize: '0.95rem',
                      textAlign: 'justify'
                    }}>
                      {section.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fine Print Section */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}>
            <h4 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.1rem',
              textAlign: 'center',
              textTransform: 'uppercase',
              color: '#666'
            }}>
              Additional Legal Terms and Conditions
            </h4>
            
            {contractSections.filter(section => section.isFinePrint).map((section, index) => (
              <div key={section.id} style={{ marginBottom: '1rem' }}>
                <h5 style={{ 
                  margin: '0 0 0.5rem 0', 
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {section.title}
                </h5>
                <p style={{ 
                  margin: 0, 
                  color: '#555', 
                  lineHeight: '1.4',
                  fontSize: '0.85rem',
                  textAlign: 'justify'
                }}>
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Signature Section */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '2rem',
            border: '2px solid #000',
            borderRadius: '0px',
            backgroundColor: '#fff'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.3rem',
              textAlign: 'center',
              textTransform: 'uppercase',
              borderBottom: '1px solid #ccc',
              paddingBottom: '0.5rem'
            }}>
              Customer Signature
            </h3>
            
            <p style={{ 
              marginBottom: '2rem', 
              textAlign: 'center',
              color: '#666',
              fontStyle: 'italic'
            }}>
              By signing below, I acknowledge that I have read, understood, and agree to all terms and conditions outlined in this agreement.
            </p>
            
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}>
                  Customer Signature:
                </label>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  onClick={handleSignatureClick}
                  placeholder="Type your full name here"
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: 'none',
                    borderBottom: '2px solid #000',
                    borderRadius: '0px',
                    fontSize: '1.3rem',
                    fontFamily: 'cursive',
                    backgroundColor: 'transparent',
                    textAlign: 'center'
                  }}
                />
              </div>
              <div style={{ 
                minWidth: '150px',
                textAlign: 'center'
              }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}>
                  Date:
                </label>
                <div style={{
                  padding: '1rem',
                  borderBottom: '2px solid #000',
                  fontSize: '1.1rem',
                  fontFamily: 'Times, serif'
                }}>
                  {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
              <button
                onClick={clearSignature}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear Signature
              </button>
              
              {typedSignature.trim() && (
                <span style={{ color: '#28a745', fontSize: '0.9rem' }}>
                  ✓ Signature entered
                </span>
              )}
            </div>

            {/* Contract Completion Status */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '0px',
              textAlign: 'center'
            }}>
              <h4 style={{ 
                margin: '0 0 1rem 0', 
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '1.1rem'
              }}>
                Contract Completion Status
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2rem' }}>
                <div style={{ 
                  color: allSectionsInitialed() ? '#28a745' : '#dc3545',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}>
                  ✓ Sections Initialed: {contractSections.filter(s => !s.isFinePrint && s.isInitialed).length} / {contractSections.filter(s => !s.isFinePrint).length}
                </div>
                <div style={{ 
                  color: typedSignature.trim() ? '#28a745' : '#dc3545',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}>
                  ✓ Signature: {typedSignature.trim() ? 'Complete' : 'Required'}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '2rem',
            padding: '1rem 0',
            borderTop: '2px solid #000'
          }}>
            <button
              id="btn-back-order-review"
              onClick={goToPreviousStep}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              ← Back to Order Review
            </button>
            <button
              id="btn-proceed-payment"
              onClick={handleContractCompletion}
              disabled={!allSectionsInitialed() || !typedSignature.trim()}
              style={{
                backgroundColor: (allSectionsInitialed() && typedSignature.trim()) ? '#28a745' : '#ccc',
                color: 'white',
                padding: '1.2rem 2.5rem',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: (allSectionsInitialed() && typedSignature.trim()) ? 'pointer' : 'not-allowed'
              }}
            >
              Complete Contract & Proceed to Payment →
            </button>
          </div>
        </div>
      )}

      {/* Initials Prompt Modal */}
      {showInitialsPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Enter Your Initials</h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Please enter your initials to initial each section of the contract:
            </p>
            
            <input
              type="text"
              value={customerInitials}
              onChange={(e) => setCustomerInitials(e.target.value.toUpperCase())}
              placeholder="Enter initials (e.g., JD)"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                width: '200px',
                textAlign: 'center',
                marginBottom: '1rem'
              }}
              maxLength={5}
            />
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowInitialsPrompt(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (customerInitials.trim()) {
                    setShowInitialsPrompt(false);
                  } else {
                    alert("Please enter your initials");
                  }
                }}
                disabled={!customerInitials.trim()}
                style={{
                  backgroundColor: customerInitials.trim() ? '#28a745' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: customerInitials.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Save Initials
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'payment' && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Payment</h2>
          <p>Payment processing will be here.</p>
          
          <div className="checkout-navigation-buttons">
            <button
              id="btn-back-contract"
              onClick={goToPreviousStep}
            >
              Back to Contract
            </button>
            <button
              id="btn-complete-payment"
            >
              Complete Payment
            </button>
          </div>
        </div>
      )}

      {/* Quantity Selection Modal */}
      {showQuantityModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '300px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Select Quantity</h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              How many {showQuantityModal} would you like to add?
            </p>
            
            <div className="checkout-quantity-buttons">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map(qty => (
                <button
                  key={qty}
                  id={`btn-quantity-${qty}`}
                  className="btn-quantity-option"
                  onClick={() => handleAddLastMinuteItem(showQuantityModal, qty)}
                >
                  {qty}
                </button>
              ))}
            </div>
            
            <button
              id="btn-quantity-cancel"
              onClick={() => setShowQuantityModal(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Back to Cart */}
      <div className="checkout-back-shopping-container">
        <button
          id="btn-back-to-shopping"
          onClick={() => navigate("/home")}
        >
          ← Back to Shopping
        </button>
      </div>
      </MantineProvider>
    </>
  );
}