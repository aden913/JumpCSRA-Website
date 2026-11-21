import { getDatabase } from 'firebase-admin/database';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const eventDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

function day(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [month, date, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${date.padStart(2, '0')}`;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? eventDateFormatter.format(date) : undefined;
}

function bookingDays(booking: any): [string | undefined, string | undefined] {
  const details = booking.orderDetails;
  const start = day(details?.eventStart);
  const end = day(details?.eventEnd);
  if (start && end) return [start, end];

  const eventDate = details?.eventDate ?? booking.eventDate ?? booking.contractDate;
  if (typeof eventDate === 'string' && eventDate.includes(' - ')) {
    const [first, last] = eventDate.split(' - ');
    return [day(first), day(last)];
  }

  const first = day(eventDate);
  if (!first) return [undefined, undefined];
  const duration = String(details?.duration ?? booking.duration ?? '').match(/(\d+)\s*(hours?|hrs?|days?|d)?/i);
  const days = duration ? Number(duration[1]) : 1;
  const last = new Date(`${first}T12:00:00Z`);
  const rentalDays = duration?.[2]?.toLowerCase().startsWith('h') ? Math.ceil(days / 24) : days;
  last.setUTCDate(last.getUTCDate() + Math.max(0, rentalDays - 1));
  return [first, Number.isFinite(last.getTime()) ? last.toISOString().slice(0, 10) : undefined];
}

export const getPartyEssentialsAvailability = onCall({ invoker: "public", maxInstances: 10 }, async request => {
  const { start, end } = request.data ?? {};
  const valid = (value: unknown): value is string => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end) || start > end) {
    throw new HttpsError('invalid-argument', 'Select a valid event date range.');
  }

  const db = getDatabase();
  const [catalogSnapshot, bookingsSnapshot, contractsSnapshot] = await Promise.all([
    db.ref('inflateables').get(), db.ref('bookings').get(), db.ref('contracts').get(),
  ]);
  const catalog = Object.values<any>(catalogSnapshot.val() ?? {});
  const bookings = bookingsSnapshot.val() ?? {};
  const { membershipBookings, ...regularBookings } = bookings;
  const contracts = contractsSnapshot.val() ?? {};
  const booked = new Map<string, number>();
  const addReserved = (name: unknown, quantity: unknown) => {
    if (typeof name !== 'string') return;
    const total = Number(quantity ?? 1);
    if (Number.isSafeInteger(total) && total > 0) booked.set(name, (booked.get(name) ?? 0) + total);
  };

  for (const [id, booking] of Object.entries<any>({ ...contracts, ...regularBookings })) {
    if (!booking || booking.status === 'cancelled') continue;
    if (Object.prototype.hasOwnProperty.call(regularBookings, id) && !['confirmed', 'deposited'].includes(booking.status)) continue;
    const [first, last] = bookingDays(booking);
    if (!first || !last || first > end || last < start) continue;
    for (const item of Object.values<any>(booking.orderDetails?.items ?? [])) {
      if (item && !item.isGiftCard) addReserved(item.name, item.quantity);
    }
  }

  for (const booking of Object.values<any>(membershipBookings ?? {})) {
    if (!booking || booking.bookingStatus === 'cancelled') continue;
    const date = day(booking.actualDeliveryDate);
    if (date && start <= date && date <= end) {
      for (const name of new Set([booking.inflatableName, booking.inflatableType])) addReserved(name, 1);
    }
  }

  return catalog.flatMap(item => {
    if (typeof item?.name !== 'string' || item.isGiftCard || /gift card/i.test(item.name)) return [];
    const categories = Array.isArray(item.category) ? item.category : [item.category];
    if (!categories.some((category: unknown) => typeof category === 'string' && category.toLowerCase() === 'party-essentials')) return [];
    const total = Number(item.quantity ?? 1);
    const stock = Number.isSafeInteger(total) && total > 0 ? total : 0;
    return [{ itemName: item.name, availableQuantity: Math.max(0, stock - (booked.get(item.name) ?? 0)) }];
  });
});
