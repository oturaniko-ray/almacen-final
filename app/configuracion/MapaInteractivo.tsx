'use client';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Después de instalar @types/leaflet esto funcionará perfecto

interface Props {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

// Fix para los iconos de Leaflet en Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
    >
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution='&copy; Google Maps'
      />
      <Marker position={[lat, lng]} icon={customIcon} />
      <MapEvents onLocationChange={onLocationChange} />
    </MapContainer>
  );
}