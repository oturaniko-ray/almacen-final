'use client';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Corregir iconos de Leaflet
const icon = L.icon({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface Props {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

function MapEvents({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
    contextmenu(e) {
      alert(`COORDENADAS PRECISAS:\nLat: ${e.latlng.lat}\nLon: ${e.latlng.lng}`);
    }
  });
  return null;
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: Props) {
  return (
    <MapContainer 
      center={[lat, lng]} 
      zoom={17} 
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution='&copy; Google Maps'
      />
      <Marker position={[lat, lng]} icon={icon} />
      <MapEvents onLocationChange={onLocationChange} />
    </MapContainer>
  );
}