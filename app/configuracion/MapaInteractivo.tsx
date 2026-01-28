'use client';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// Sub-componente para centrar el mapa y manejar clics
function MapController({ lat, lng, onLocationChange }: Props) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
    contextmenu(e) {
      alert(`COORDENADAS TÉCNICAS:\nLat: ${e.latlng.lat}\nLon: ${e.latlng.lng}`);
    }
  });

  return (
    <>
      <Marker position={[lat, lng]} icon={customIcon} />
      <button 
        onClick={(e) => {
          e.preventDefault();
          map.locate().on('locationfound', (ev) => {
            map.flyTo(ev.latlng, 18);
            onLocationChange(ev.latlng.lat, ev.latlng.lng);
          });
        }}
        className="absolute bottom-4 right-4 z-[1000] bg-white text-black p-3 rounded-full shadow-2xl border-2 border-blue-500 hover:bg-blue-50 transition-all font-black text-xs flex items-center gap-2"
      >
        📍 MI UBICACIÓN ACTUAL
      </button>
    </>
  );
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: Props) {
  return (
    <div className="relative h-full w-full">
      <MapContainer 
        center={[lat, lng]} 
        zoom={18} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        <MapController lat={lat} lng={lng} onLocationChange={onLocationChange} />
      </MapContainer>
    </div>
  );
}