'use client';
import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Solución para el icono por defecto de Leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapaInteractivo({ lat, lng, onLocationChange }: any) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const nLat = parseFloat(lat) || -12.046374;
  const nLng = parseFloat(lng) || -77.042793;

  // Solo renderizar en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Inicializar el mapa cuando el componente esté montado en el cliente
  useEffect(() => {
    if (!isClient || !mapContainerRef.current) return;

    // Si ya existe un mapa, destruirlo antes de crear uno nuevo
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Crear el mapa
    const map = L.map(mapContainerRef.current).setView([nLat, nLng], 18);
    mapRef.current = map;

    // Añadir capa de Google Satellite
    L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
    }).addTo(map);

    // Crear marcador
    const marker = L.marker([nLat, nLng], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    // Manejar clics en el mapa
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      
      // Actualizar marcador
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const newMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = newMarker;
      }

      // Notificar cambio
      onLocationChange(lat, lng);
    });

    // Botón para ubicar al usuario - usando el método correcto de Leaflet
    const locateButton = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: function() {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        btn.innerHTML = '📍';
        btn.title = 'Ubicarme';
        btn.style.backgroundColor = 'white';
        btn.style.width = '40px';
        btn.style.height = '40px';
        btn.style.fontSize = '20px';
        btn.style.cursor = 'pointer';
        btn.style.border = '2px solid #3b82f6';
        btn.style.borderRadius = '8px';
        btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        
        btn.onclick = () => {
          map.locate({ setView: true, maxZoom: 18 });
        };
        
        return btn;
      }
    });

    map.addControl(new locateButton());

    // Manejar evento de localización
    map.on('locationfound', (e) => {
      const { lat, lng } = e.latlng;
      
      // Actualizar marcador
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const newMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = newMarker;
      }

      // Notificar cambio
      onLocationChange(lat, lng);
    });

    // Limpiar al desmontar
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isClient, nLat, nLng, onLocationChange]);

  // Actualizar marcador cuando cambian las coordenadas externamente
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    
    markerRef.current.setLatLng([nLat, nLng]);
    mapRef.current.setView([nLat, nLng], 18);
  }, [nLat, nLng]);

  if (!isClient) {
    return (
      <div className="h-full w-full bg-[#020617] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">
        Cargando mapa...
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="h-full w-full relative"
      style={{ minHeight: '350px' }}
    />
  );
}