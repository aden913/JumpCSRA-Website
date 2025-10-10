# localStorage Key Mapping - Jump CSRA Website

## ✅ **STANDARDIZED KEYS** (All components now use these)

| Setting | localStorage Key | Used By |
|---------|------------------|---------|
| **Cart Duration** | `cart_duration` | useCartSettings, CartSidebar, Checkout |
| **Surface Type** | `cart_surface` | useCartSettings, CartSidebar, Checkout |
| **Delivery Time** | `cart_deliveryTime` | useCartSettings, CartSidebar, Checkout |
| **Location Type** | `cart_location` | useCartSettings, CartSidebar, Checkout |
| **Wet/Dry Selections** | `cart_wetDrySelections` | useCartSettings, CartSidebar |
| **Gift Card Values** | `cart_giftCardValues` | useCartSettings, CartSidebar |
| **Calendar Date Range** | `calendarDateRange` | Welcome, Checkout |
| **Cart Items** | `cart` | useCart, Welcome, Checkout |
| **Order Message** | `orderMessage` | CartSidebar |

## 🔧 **Data Flow:**

### Welcome Page Flow:
1. `useWelcomeLogic()` calls `useCartSettings()`
2. `useCartSettings()` loads from `cart_*` keys
3. Welcome passes `cartSettings` to `CartSidebar`
4. `CartSidebar` uses either `cartSettings` props OR falls back to its own localStorage with `cart_*` keys

### Checkout Page Flow:
1. `Checkout` calls `useCartSettings()`  
2. `useCartSettings()` loads from `cart_*` keys
3. Checkout displays settings from `cartSettings` object

### Navigation Flow:
1. **Welcome → Checkout**: cartSettings persist via `cart_*` keys
2. **Checkout → Welcome**: cartSettings persist via `cart_*` keys
3. **Page Refresh**: All settings reload from `cart_*` keys

## 🚨 **Previous Issues (FIXED):**

❌ **Before Fix:** Multiple conflicting key patterns:
- useCartSettings: `cart_duration`, `cart_surface`, etc.
- CartSidebar: `cartDuration`, `cartSurface`, `wetDrySelections`, etc.
- Different components couldn't share state

✅ **After Fix:** Unified key pattern:
- All components use `cart_*` prefixed keys
- Perfect synchronization between Welcome and Checkout pages
- CartSidebar backward compatible (uses cartSettings props when available)

## 🎯 **Benefits of Current Implementation:**

1. **Consistent Persistence**: All cart settings persist across page navigation
2. **Backward Compatibility**: CartSidebar works with or without cartSettings props
3. **Type Safety**: Full TypeScript support throughout the chain
4. **Error Handling**: Graceful fallbacks for corrupted localStorage data
5. **Performance**: Debounced saves, efficient state updates
6. **User Experience**: No lost settings when navigating between pages

## 📝 **Testing Checklist:**

- [ ] Set duration on Welcome page → Navigate to Checkout → Back to Welcome (should persist)
- [ ] Set surface type on Welcome page → Navigate to Checkout → Back to Welcome (should persist)  
- [ ] Set delivery time on Welcome page → Navigate to Checkout → Back to Welcome (should persist)
- [ ] Set location on Welcome page → Navigate to Checkout → Back to Welcome (should persist)
- [ ] Select wet/dry for items → Navigate to Checkout → Back to Welcome (should persist)
- [ ] Set gift card values → Navigate to Checkout → Back to Welcome (should persist)
- [ ] Refresh page on any page → All settings should reload correctly