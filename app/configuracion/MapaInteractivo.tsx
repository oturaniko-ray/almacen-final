'use client';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapUpdater({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && lat !== 0) {
      map.setView([lat, lng], 18);
    }
  }, [lat, lng, map]);
  return null;
}

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
          map.locate().on('locationfound', (ev) => {
            map.flyTo(ev.latlng, 18);
            onLocationChange(ev.latlng.lat, ev.latlng.lng);
          });
        }}
        className="absolute bottom-4 right-4 z-[1000] bg-white text-black px-4 py-2 rounded-full shadow-2xl border-2 border-blue-600 font-black text-[10px] hover:bg-blue-50 transition-all uppercase"
      >
        📍 Posición Actual
      </button>
    </>
  );
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: any) {
  const nLat = parseFloat(lat) || 0;
  const nLng = parseFloat(lng) || 0;

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={[nLat, nLng]} 
        zoom={18} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        <MapUpdater lat={nLat} lng={nLng} />
        <MapController lat={nLat} lng={nLng} onLocationChange={onLocationChange} />
      </MapContainer>
    </div>
  );
}