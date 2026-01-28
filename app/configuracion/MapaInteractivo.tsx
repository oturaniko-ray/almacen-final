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

interface Props {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

function MapUpdater({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
      map.setView([lat, lng], 18);
    }
  }, [lat, lng, map]);
  return null;
}

function MapController({ lat, lng, onLocationChange }: Props) {
  const map = useMap();
  useMapEvents({
    click(e) { onLocationChange(e.latlng.lat, e.latlng.lng); }
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
        className="absolute bottom-4 right-4 z-[1000] bg-white text-black px-4 py-2 rounded-full shadow-2xl border-2 border-blue-600 font-black text-[10px] hover:bg-blue-50"
      >
        📍 MI UBICACIÓN ACTUAL
      </button>
    </>
  );
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: Props) {
  const centerLat = !isNaN(lat) ? lat : 0;
  const centerLng = !isNaN(lng) ? lng : 0;

  return (
    <MapContainer center={[centerLat, centerLng]} zoom={18} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
      <MapUpdater lat={centerLat} lng={centerLng} />
      <MapController lat={centerLat} lng={centerLng} onLocationChange={onLocationChange} />
    </MapContainer>
  );
}