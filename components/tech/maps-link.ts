/** Opens the address in Google Maps (the app on phones, the website elsewhere). */
export const mapsLink = (address: { line1: string; city: string; pincode: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${address.line1}, ${address.city} ${address.pincode}`,
  )}`;
