"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPartyEssentialsAvailability = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const eventDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
function day(value) {
    if (typeof value !== 'string' && typeof value !== 'number')
        return undefined;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
        return value;
    if (typeof value === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        const [month, date, year] = value.split('/');
        return `${year}-${month.padStart(2, '0')}-${date.padStart(2, '0')}`;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? eventDateFormatter.format(date) : undefined;
}
function bookingDays(booking) {
    var _a, _b, _c, _d, _e;
    const details = booking.orderDetails;
    const start = day(details === null || details === void 0 ? void 0 : details.eventStart);
    const end = day(details === null || details === void 0 ? void 0 : details.eventEnd);
    if (start && end)
        return [start, end];
    const eventDate = (_b = (_a = details === null || details === void 0 ? void 0 : details.eventDate) !== null && _a !== void 0 ? _a : booking.eventDate) !== null && _b !== void 0 ? _b : booking.contractDate;
    if (typeof eventDate === 'string' && eventDate.includes(' - ')) {
        const [first, last] = eventDate.split(' - ');
        return [day(first), day(last)];
    }
    const first = day(eventDate);
    if (!first)
        return [undefined, undefined];
    const duration = String((_d = (_c = details === null || details === void 0 ? void 0 : details.duration) !== null && _c !== void 0 ? _c : booking.duration) !== null && _d !== void 0 ? _d : '').match(/(\d+)\s*(hours?|hrs?|days?|d)?/i);
    const days = duration ? Number(duration[1]) : 1;
    const last = new Date(`${first}T12:00:00Z`);
    const rentalDays = ((_e = duration === null || duration === void 0 ? void 0 : duration[2]) === null || _e === void 0 ? void 0 : _e.toLowerCase().startsWith('h')) ? Math.ceil(days / 24) : days;
    last.setUTCDate(last.getUTCDate() + Math.max(0, rentalDays - 1));
    return [first, Number.isFinite(last.getTime()) ? last.toISOString().slice(0, 10) : undefined];
}
exports.getPartyEssentialsAvailability = (0, https_1.onCall)({ invoker: "public", maxInstances: 10 }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const { start, end } = (_a = request.data) !== null && _a !== void 0 ? _a : {};
    const valid = (value) => typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value;
    if (!valid(start) || !valid(end) || start > end) {
        throw new https_1.HttpsError('invalid-argument', 'Select a valid event date range.');
    }
    const db = (0, database_1.getDatabase)();
    const [catalogSnapshot, bookingsSnapshot, contractsSnapshot] = await Promise.all([
        db.ref('inflateables').get(), db.ref('bookings').get(), db.ref('contracts').get(),
    ]);
    const catalog = Object.values((_b = catalogSnapshot.val()) !== null && _b !== void 0 ? _b : {});
    const bookings = (_c = bookingsSnapshot.val()) !== null && _c !== void 0 ? _c : {};
    const { membershipBookings } = bookings, regularBookings = __rest(bookings, ["membershipBookings"]);
    const contracts = (_d = contractsSnapshot.val()) !== null && _d !== void 0 ? _d : {};
    const booked = new Map();
    const addReserved = (name, quantity) => {
        var _a;
        if (typeof name !== 'string')
            return;
        const total = Number(quantity !== null && quantity !== void 0 ? quantity : 1);
        if (Number.isSafeInteger(total) && total > 0)
            booked.set(name, ((_a = booked.get(name)) !== null && _a !== void 0 ? _a : 0) + total);
    };
    for (const [id, booking] of Object.entries(Object.assign(Object.assign({}, contracts), regularBookings))) {
        if (!booking || booking.status === 'cancelled')
            continue;
        if (Object.prototype.hasOwnProperty.call(regularBookings, id) && !['confirmed', 'deposited'].includes(booking.status))
            continue;
        const [first, last] = bookingDays(booking);
        if (!first || !last || first > end || last < start)
            continue;
        for (const item of Object.values((_f = (_e = booking.orderDetails) === null || _e === void 0 ? void 0 : _e.items) !== null && _f !== void 0 ? _f : [])) {
            if (item && !item.isGiftCard)
                addReserved(item.name, item.quantity);
        }
    }
    for (const booking of Object.values(membershipBookings !== null && membershipBookings !== void 0 ? membershipBookings : {})) {
        if (!booking || booking.bookingStatus === 'cancelled')
            continue;
        const date = day(booking.actualDeliveryDate);
        if (date && start <= date && date <= end) {
            for (const name of new Set([booking.inflatableName, booking.inflatableType]))
                addReserved(name, 1);
        }
    }
    return catalog.flatMap(item => {
        var _a, _b;
        if (typeof (item === null || item === void 0 ? void 0 : item.name) !== 'string' || item.isGiftCard || /gift card/i.test(item.name))
            return [];
        const categories = Array.isArray(item.category) ? item.category : [item.category];
        if (!categories.some((category) => typeof category === 'string' && category.toLowerCase() === 'party-essentials'))
            return [];
        const total = Number((_a = item.quantity) !== null && _a !== void 0 ? _a : 1);
        const stock = Number.isSafeInteger(total) && total > 0 ? total : 0;
        return [{ itemName: item.name, availableQuantity: Math.max(0, stock - ((_b = booked.get(item.name)) !== null && _b !== void 0 ? _b : 0)) }];
    });
});
//# sourceMappingURL=partyEssentialsAvailability.js.map