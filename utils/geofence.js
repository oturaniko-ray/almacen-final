export const WAREHOUSE_POINTS = [
  { lat: 40.597026870096144, lng: -3.595155315533437 },
  { lat: 40.597186269698526, lng: -3.595536993957565 },
  { lat: 40.59690832967445, lng: -3.59456593060595 }
];

export const checkGeofence = (lat: number, lng: number) => {
  return WAREHOUSE_POINTS.some(point => {
    const R = 6371e3; // Radio tierra metros
    const dLat = (point.lat - lat) * Math.PI / 180;
    const dLon = (point.lng - lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) <= 50; // 50 metros de margen
  });
};