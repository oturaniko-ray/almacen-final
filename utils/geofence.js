// utils/geofence.js

// 1. Aquí colocamos tus coordenadas reales que proporcionaste
export const WAREHOUSE_POINTS = [
  { lat: 40.597026870096144, lng: -3.595155315533437 },
  { lat: 40.597186269698526, lng: -3.595536993957565 },
  { lat: 40.59690832967445, lng: -3.59456593060595 }
];

// 2. Esta función calcula la distancia real en metros (Fórmula Haversine)
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// 3. Esta es la función que tú tenías, ahora usando la lógica de arriba
export const checkGeofence = (userLat, userLng) => {
  return WAREHOUSE_POINTS.some(point => {
    const distance = getDistance(userLat, userLng, point.lat, point.lng);
    return distance <= 50; // Margen de 50 metros
  });
};