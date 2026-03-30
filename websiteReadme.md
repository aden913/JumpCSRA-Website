# JumpCSRA Website - Technical Documentation

## Project Overview

JumpCSRA is a full-stack party rental e-commerce platform built with React Router v7, Firebase, and PayPal integration. The application enables customers to browse inflatable bounce houses, games, and party essentials, manage bookings, apply promotional codes, purchase gift cards, and complete payments with flexible deposit options.

---

## Technology Stack

### Frontend
- **React Router v7** - File-based routing with SSR support
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Mantine UI** - Component library for notifications and UI elements
- **Swiper** - Carousel components
- **PayPal React SDK** - Payment integration
- **Google Places API** - Address autocomplete
- **Lottie** - Animated icons

### Backend
- **Firebase Realtime Database** - Primary data storage
- **Firestore** - User data, discount tracking
- **Firebase Functions** - Email automation, scheduled tasks
- **Firebase Authentication** - User auth system
- **Firebase Storage** - File storage
- **SendGrid** - Email delivery service

### Payment Processing
- **PayPal REST API** - Payment processing
- **PayPal Vaulting** - Saved payment methods
- **Wallet System** - Store credit functionality

---

## Architecture

### Application Structure

```
JumpCSRA/
├── app/
│   ├── routes/                 # Route handlers
│   │   ├── home.tsx           # Landing page
│   │   ├── checkout.tsx       # Multi-step checkout
│   │   └── subscription-success.tsx
│   ├── components/            # Reusable UI components
│   │   ├── CartSidebar.tsx
│   │   ├── CalendarSidebar.tsx
│   │   ├── ContractSigning.tsx
│   │   ├── GooglePlacesAutocomplete.tsx
│   │   ├── MembershipCheckout.tsx
│   │   └── WalletFunding.tsx
│   ├── hooks/                 # Custom React hooks
│   │   ├── useCart.ts
│   │   ├── useDiscounts.ts
│   │   ├── useInflateables.ts
│   │   └── usePayPalVault.ts
│   ├── utils/                 # Utility functions
│   │   ├── databaseUtils.ts
│   │   ├── bookingUtils.ts
│   │   ├── emailUtils.ts
│   │   └── paypalInvoiceUtils.ts
│   ├── welcome/               # Landing page logic
│   │   ├── index.tsx
│   │   └── useWelcomeLogic.ts
│   └── routes.ts              # Route configuration
├── functions/                 # Firebase Cloud Functions
│   └── src/
│       ├── index.ts           # Email automation
│       └── services/
│           ├── emailService.ts
│           └── paypalService.ts
└── public/                    # Static assets
```

---

## Database Structure

### Firebase Realtime Database

```
/
├── dashboardInformation/
│   ├── inflatables/           # Product catalog
│   │   └── {productId}
│   │       ├── name
│   │       ├── price (weekday/weekend)
│   │       ├── category
│   │       ├── images[]
│   │       └── availability
│   ├── discounts/             # Discount definitions
│   │   └── {discountId}
│   │       ├── code
│   │       ├── type (percent/static)
│   │       ├── value
│   │       ├── endDate
│   │       ├── requirement
│   │       └── requirementType
│   ├── promoCards/            # Homepage promo cards (1-3)
│   │   └── {1-3}
│   │       ├── slot
│   │       ├── cardText
│   │       ├── code
│   │       ├── enabled
│   │       ├── notificationTitle
│   │       ├── notificationMessage
│   │       ├── discountApplication (price/items/bogo)
│   │       ├── discountType (percent/static)
│   │       ├── discountValue
│   │       ├── itemCategories[]
│   │       ├── requirementType (none/minimumCartValue/containsProducts/containsCategory/byDay)
│   │       ├── requirement
│   │       ├── bogoProductId (optional)
│   │       ├── bogoDiscountType (optional)
│   │       └── bogoDiscountValue (optional)
│   └── partyEssentials/       # Add-on items
│
├── bookings/
│   └── {orderID}
│       ├── orderID
│       ├── customerID
│       ├── status (deferred/pending/deposited/confirmed/completed/cancelled)
│       ├── approved (boolean for deferred)
│       ├── customerInfo
│       │   ├── firstName, lastName, name
│       │   ├── email
│       │   └── phone
│       ├── orderDetails
│       │   ├── eventDate
│       │   ├── duration
│       │   ├── deliveryAddress
│       │   ├── surface
│       │   ├── deliveryTime
│       │   ├── eventStart (optional)
│       │   ├── eventEnd (optional)
│       │   ├── notes (optional)
│       │   ├── items[]
│       │   │   ├── name
│       │   │   ├── quantity
│       │   │   ├── price
│       │   │   ├── adjustedPrice
│       │   │   ├── captureIds[]
│       │   │   └── discountApplied
│       │   ├── totalAmount
│       │   ├── adjustmentTax
│       │   ├── adjustmentEventStart
│       │   ├── adjustmentEventDuration
│       │   ├── adjustmentSurface
│       │   ├── adjustmentDelivery
│       │   └── discount (optional)
│       ├── paymentDetails
│       │   ├── totalAmount
│       │   ├── depositAmount
│       │   ├── remainingBalance
│       │   ├── paymentType (full/deposit)
│       │   ├── tip
│       │   ├── paypalOrderId
│       │   ├── paypalCaptureId
│       │   ├── paypalTransactionId
│       │   ├── paymentStatus
│       │   ├── paymentHistory[]
│       │   ├── discount (optional)
│       │   └── giftCardPayment (optional)
│       ├── emails
│       │   ├── depositReminder
│       │   ├── eventConfirmation
│       │   ├── thanks
│       │   └── rebooking
│       ├── createdAt
│       └── updatedAt
│
├── contracts/                 # Digital contracts
│   └── {contractId}
│       ├── contractId
│       ├── userId
│       ├── status
│       ├── orderDetails (subset of booking)
│       ├── agreementSections[]
│       ├── signature
│       └── initials
│
├── giftCards/
│   └── {giftCardCode}
│       ├── code
│       ├── balance
│       ├── originalBalance
│       ├── recipientEmail
│       ├── createdAt
│       ├── usageHistory[]
│       └── transactionHistory[]
│
├── userDiscountUsage/         # Tracks discount usage per user
│   └── {userID}
│       └── {discountId}
│           ├── discountCode
│           ├── discountType
│           ├── usedAt
│           └── orderID
│
└── unavailableDates/          # Date-based availability
    └── {itemId}
        └── {dateKey}
            └── quantity
```

### Firestore

```
/users/{userId}
    ├── uid
    ├── email
    ├── firstName, lastName, name
    ├── wallet
    │   ├── balance
    │   ├── transactions[]
    │   └── lastUpdated
    ├── usedDiscounts[]        # Track one-time promo codes
    ├── savedPaymentMethods[]
    ├── membershipStatus
    └── createdAt

/orders/{orderId}              # Firestore backup of booking data
    └── (mirrors RTDB booking structure)
```

---

## Key Components

### 1. Home/Landing Page (`routes/home.tsx` + `welcome/`)

**Purpose**: Product browsing, cart management, discount activation

**Key Features**:
- Product carousel with category filtering
- Real-time availability checking
- Dynamic promo card display (loaded from database)
- Cart management with local storage persistence
- Calendar date selection
- Discount activation (Sunday 10%, Free Game, BOGO Gift Cards)

**State Management**:
- `useWelcomeLogic` - Main landing page logic
- `useCart` - Cart state and operations
- `useInflateables` - Product catalog loading
- `useDiscounts` - Discount logic and validation
- `usePromoCards` - Dynamic promo card loading

**Data Flow**:
```
Firebase RTDB → useInflateables → Product Display
User Interaction → useCart → LocalStorage
Firebase RTDB → usePromoCards → Dynamic Cards → useDiscounts
```

### 2. Checkout Flow (`routes/checkout.tsx`)

**Purpose**: 6-step checkout process with payment integration

**Steps**:
1. **Event Details**: Date, duration, delivery time, surface type
2. **Delivery Address**: Google Places autocomplete
3. **Party Essentials**: Last-minute add-ons
4. **Payment Method**: Full payment vs deposit (25% minimum)
5. **Contract Review**: Digital signature, initials
6. **Payment Processing**: PayPal or wallet payment

**Key Features**:
- Multi-step wizard with validation
- Real-time price calculation with discounts
- Promo code entry and validation
- Gift card redemption
- PayPal payment integration
- Wallet payment system
- Contract signing with typed signature
- Booking persistence (deferred bookings)
- Email confirmation automation

**State Management**:
- `eventNotes` - Customer notes
- Promo code state (`appliedPromoCode`, `promoCodeError`)
- Gift card state (`appliedGiftCard`, `giftCardCode`)
- Payment state (`paymentType`, `depositAmount`)
- Form validation state
- Contract state (`typedSignature`, `customerInitials`)

**Data Flow**:
```
Cart + Form Data → Booking Data Structure
→ Save to RTDB bookings/
→ Save to RTDB contracts/
→ Save to Firestore orders/
→ Track discount usage (RTDB + Firestore)
→ Track gift card usage
→ Trigger email via Cloud Function
→ Update wallet balance (if applicable)
```

### 3. Profile Page (`profile.tsx`)

**Purpose**: Order history, wallet management

**Features**:
- View past bookings
- Resume incomplete bookings
- Wallet balance display
- Wallet funding via PayPal
- Payment history

### 4. Cart System (`components/CartSidebar.tsx` + `hooks/useCart.ts`)

**Storage**: LocalStorage with key `cart`

**Operations**:
- Add/remove items
- Update quantities
- Apply discounts
- Calculate totals with taxes
- Persist across sessions

### 5. Discount System (`hooks/useDiscounts.ts`)

**Discount Types**:
1. **Homepage Discounts** (mutually exclusive):
   - `sunday10` - 10% off on Sunday events
   - `freeGame` - Free yard game upgrade
   - `bogoGiftCard` - Buy one gift card, get one free

2. **Manual Promo Codes** (entered at checkout):
   - Loaded from `dashboardInformation/discounts/`
   - Configurable requirements:
     - `minimumCartValue` - Cart must exceed amount
     - `containsProducts` - Cart must contain specific products
     - `containsCategory` - Cart must contain items from category
     - `byDay` - Event must be on specific day
   - One-time use per user (tracked in Firestore)

3. **Dynamic Promo Cards**:
   - Loaded from `dashboardInformation/promoCards/1-3`
   - Support total price discount, item-specific discount, or BOGO offers
   - BOGO fields: `bogoProductId`, `bogoDiscountType`, `bogoDiscountValue`

**Validation**:
- Expiration date checking
- User eligibility (Firestore `usedDiscounts` array)
- Cart requirement validation
- Conflict prevention (homepage vs manual codes)

**Tracking** (when order completes):
- RTDB: `userDiscountUsage/{userID}/{discountId}`
- Firestore: `users/{id}/usedDiscounts[]`

### 6. Gift Card System

**Gift Card Types**:
- **Purchased Gift Cards**: Customer buys for someone else
- **BOGO Gift Cards**: Promotional free gift cards
- **Redeemable Gift Cards**: Used at checkout to reduce total

**Data Structure** (`giftCards/{code}`):
```typescript
{
  code: string,
  balance: number,
  originalBalance: number,
  recipientEmail: string,
  purchaserEmail: string,
  createdAt: timestamp,
  usageHistory: [
    { usedAmount, timestamp, orderID, remainingBalance }
  ],
  transactionHistory: [
    { type: 'created' | 'redeemed' | 'expired',
      amount, timestamp, orderID, description }
  ]
}
```

**Gift Card Usage Flow**:
1. Customer enters code at checkout
2. `validateGiftCard()` checks code exists and has balance
3. Applied amount calculated (up to remaining total)
4. On payment success:
   - Update `giftCards/{code}/balance`
   - Add to `usageHistory` and `transactionHistory`
   - Store in `orderDetails.giftCardPayment`

### 7. Payment System

**Payment Methods**:
1. **PayPal** (via PayPal REST API):
   - Full payment or deposit
   - Capture IDs tracked per line item (for partial refunds)
   - Vaulted payment methods for saved cards
   
2. **Wallet** (stored credit):
   - Deduct from user's wallet balance
   - Transaction history tracked
   - Funded via PayPal

**Payment Flow**:
```
User Selects Payment Type (Full/Deposit)
→ calculateTotalAmount() (includes discounts, gift cards, wallet)
→ PayPal Order Created
→ PayPal Payment Captured
→ Update RTDB booking with capture IDs
→ Track discount usage
→ Track gift card usage
→ Update wallet balance (if used)
→ Trigger confirmation email
```

**Deposit Logic**:
- Minimum 25% of total
- Remaining balance due before event
- Payment history tracked in `paymentDetails.paymentHistory[]`

### 8. Email Automation (`functions/src/`)

**Email Types**:
1. **Order Confirmation** - Sent immediately after booking
2. **Deposit Reminder** - Sent if deposit option chosen
3. **Event Confirmation** - Sent before event date
4. **Thank You** - Sent after event
5. **Rebooking** - Sent to encourage repeat bookings
6. **Gift Card Notification** - Sent to gift card recipient

**Architecture**:
- **Trigger**: HTTP callable Cloud Functions
- **Delivery**: SendGrid API
- **Templates**: HTML email templates with invoice styling
- **Configuration**: Stored in `scheduled-emails-config.json`

**Scheduling**:
```typescript
scheduleAutomatedEmails({
  orderID,
  customerEmail,
  eventDate,
  bookingStatus,
  // Email triggers scheduled based on event date
})
```

---

## Data Flow Diagrams

### Complete Booking Flow

```
1. BROWSE PRODUCTS
   Firebase RTDB (inflatables) → useInflateables → Product Display
   User Clicks Product → ProductDetailModal
   User Adds to Cart → useCart → LocalStorage

2. ACTIVATE DISCOUNT (Optional)
   Firebase RTDB (promoCards) → usePromoCards → Display Cards
   User Clicks Promo Card → useDiscounts.toggleDiscount()
   → LocalStorage (activeDiscounts)

3. CHECKOUT PROCESS
   Step 1-3: Form Data Entry
   Step 4: Apply Promo Code
      → Firebase RTDB (discounts/{code})
      → Validate requirements
      → Check Firestore usedDiscounts
   Step 4: Apply Gift Card
      → Firebase RTDB (giftCards/{code})
      → Validate balance
   Step 5: Digital Contract
      → Capture signature, initials
   Step 6: Payment
      → Calculate final amount (cart - discounts - gift card - wallet)
      → Create PayPal order OR deduct from wallet
      → Capture payment

4. SAVE BOOKING
   BookingData created
   → Save to RTDB bookings/{orderID}
   → Save to RTDB contracts/{contractID}
   → Save to Firestore orders/{orderID}
   → Track discount: RTDB userDiscountUsage + Firestore usedDiscounts
   → Track gift card: Update giftCards/{code}
   → Update wallet if used
   → Trigger email Cloud Function

5. EMAIL AUTOMATION
   Cloud Function triggered
   → SendGrid sends order confirmation
   → Schedule follow-up emails (deposit reminder, event confirmation, etc.)
```

### Discount Validation Flow

```
User Enters Promo Code
→ Query RTDB discounts/{code}
→ Check expiration date
→ Check Firestore users/{id}/usedDiscounts (one-time use)
→ Validate requirements:
   - minimumCartValue: Compare cart total
   - containsProducts: Check cart for specific items
   - containsCategory: Check cart for category items
   - byDay: Check event date day of week
→ Apply discount to cart
→ On checkout success:
   - Add to RTDB userDiscountUsage/{userID}/{discountId}
   - Add to Firestore users/{id}/usedDiscounts[]
```

### Gift Card Flow

```
PURCHASE:
User Buys Gift Card → Add to Cart → Checkout
→ Payment Captured
→ generateUniqueGiftCardCode()
→ Save to RTDB giftCards/{code}
→ Email sent to recipient with code

REDEMPTION:
User Enters Code at Checkout
→ validateGiftCard(code)
→ Check balance
→ Calculate applied amount (min of balance and remaining total)
→ On payment success:
   - Deduct from giftCards/{code}/balance
   - Add to usageHistory
   - Add to transactionHistory
   - Store in booking.paymentDetails.giftCardPayment
```

---

## Key Features

### 1. Multi-Tenant Availability System
- Real-time availability checking across date ranges
- Quantity-based inventory management
- Conflict prevention for overlapping bookings

### 2. Flexible Pricing
- Weekday/weekend pricing
- Duration multipliers (4hr, 6hr, 8hr)
- Wet/dry surcharges
- Early delivery fees
- Surface type charges
- Tax calculation (8%)

### 3. Booking Statuses
- **deferred** - Event within 48 hours, requires phone confirmation
- **pending** - Awaiting admin approval
- **deposited** - Deposit paid, balance due
- **confirmed** - Fully paid and confirmed
- **completed** - Event finished
- **cancelled** - Booking cancelled

### 4. Advanced Discount System
- Homepage promotional cards (database-driven)
- Manual promo codes with requirements
- BOGO (Buy One Get One) offers
- Category-specific discounts
- One-time use enforcement

### 5. Digital Contracts
- Multi-section rental agreement
- Typed signature capture
- Initial collection per section
- Stored in RTDB for legal compliance

### 6. Wallet System
- Store credit balance
- Fund via PayPal
- Use at checkout
- Transaction history

### 7. Resumable Bookings
- Incomplete bookings saved
- Resume from profile page
- URL-based booking recovery

---

## Environment Variables

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=

# PayPal
VITE_PAYPAL_CLIENT_ID=

# SendGrid (Cloud Functions)
SENDGRID_API_KEY=

# PayPal Secret (Cloud Functions)
PAYPAL_CLIENT_SECRET=
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Development server (Vite)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Run tests
npm test

# Deploy Firebase Functions
cd functions
npm run deploy
```

---

## Security Considerations

1. **Authentication**: Firebase Auth with email/password
2. **Data Access**: Firestore security rules enforce user-scoped access
3. **Payment Security**: PayPal handles all sensitive payment data
4. **Contract Storage**: Contracts stored in Firebase with user-scoped access
5. **Discount Tracking**: Firestore prevents duplicate promo code usage
6. **Gift Card Codes**: Unique code generation with collision prevention

---

## Future Enhancements

- Admin dashboard for managing bookings, discounts, and inventory
- SMS notifications via Twilio
- In-app chat system
- Rating/review system
- Photo gallery uploads from events
- Automated refund processing
- Advanced reporting and analytics

---

## Additional Resources

- **Firebase Realtime Database**: Real-time data sync
- **Firestore**: Scalable document store for user data
- **PayPal Developer**: https://developer.paypal.com
- **SendGrid**: https://sendgrid.com/docs
- **React Router v7**: https://reactrouter.com

---

**Last Updated**: March 30, 2026
**Version**: 1.0.0
**Maintained By**: JumpCSRA Development Team
