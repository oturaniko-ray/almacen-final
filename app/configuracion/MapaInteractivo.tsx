'use client';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Corrección de Icono para Next.js / Leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Componente para re-centrar el mapa cuando cambian las coordenadas externamente
function MapUpdater({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && lat !== 0) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

// Controlador de clics y geolocalización nativa
function MapController({ lat, lng, onLocationChange }: any) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    }
  });

  return (
    <>
      <Marker position={[lat, lng]} icon={customIcon} />
      <button 
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          map.locate().on('locationfound', (ev) => {
            map.flyTo(ev.latlng, 18);
            onLocationChange(ev.latlng.lat, ev.latlng.lng);
          });
        }}
        className="absolute bottom-4 right-4 z-[1000] bg-white text-black px-4 py-2 rounded-full shadow-2xl border-2 border-blue-600 font-black text-[10px] hover:bg-blue-50 transition-all uppercase flex items-center gap-2"
      >
        <span className="text-blue-600">📍</span> Posición Actual
      </button>
    </>
  );
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: any) {
  // Conversión segura de tipos para evitar errores de Leaflet
  const nLat = parseFloat(lat) || 0;
  const nLng = parseFloat(lng) || 0;

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={[nLat, nLng]} 
        zoom={18} 
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Inversión de color para modo oscuro técnico
          className="invert-90-brightness-50" 
        />
        
        <MapUpdater lat={nLat} lng={nLng} />
        
        <MapController 
          lat={nLat} 
          lng={nLng} 
          onLocationChange={onLocationChange} 
        />
      </MapContainer>

      {/* Overlay de diseño técnico */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md p-2 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Gps_Signal_Active</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .invert-90-brightness-50 {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-container {
          background: #0f172a !important;
        }
      `}</style>
    </div>
  );
}