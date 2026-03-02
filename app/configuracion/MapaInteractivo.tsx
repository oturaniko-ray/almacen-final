'use client';
import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getCurrentLocation, getAddressFromCoordinates } from '@/lib/locationService';

// Solución para el icono por defecto de Leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapaInteractivoProps {
  lat: string;
  lng: string;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapaInteractivo({ lat, lng, onLocationChange }: MapaInteractivoProps) {
  const [isClient, setIsClient] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [geocodingStatus, setGeocodingStatus] = useState<'loading' | 'success' | 'error'>('success');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const nLat = parseFloat(lat) || -12.046374;
  const nLng = parseFloat(lng) || -77.042793;

  // Solo renderizar en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Función para obtener dirección con manejo de errores
  // En MapaInteractivo.tsx, la función fetchAddress:
  const fetchAddress = async (lat: number, lng: number) => {
    setGeocodingStatus('loading');
    try {
      const addressResult = await getAddressFromCoordinates(lat, lng);
      if (addressResult) {
        setAddress(addressResult);
        setGeocodingStatus('success');
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setGeocodingStatus('error');
      }
    } catch (error) {
      console.error('Error obteniendo dirección:', error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setGeocodingStatus('error');
    }
  };

  // Obtener dirección cuando cambian las coordenadas
  useEffect(() => {
    if (nLat !== 0 && nLng !== 0) {
      fetchAddress(nLat, nLng);
    }
  }, [nLat, nLng]);

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

      // Obtener dirección del punto clickeado
      fetchAddress(lat, lng);

      // Notificar cambio
      onLocationChange(lat, lng);
    });

    // Botón para ubicar al usuario - usando el método correcto de Leaflet
    const LocateButton = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        btn.innerHTML = '📍 Ubícame';
        btn.title = 'Usar mi ubicación actual';
        btn.style.backgroundColor = '#065f46';
        btn.style.color = 'white';
        btn.style.width = 'auto';
        btn.style.height = '34px';
        btn.style.padding = '0 12px';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '900';
        btn.style.letterSpacing = '0.05em';
        btn.style.cursor = 'pointer';
        btn.style.border = '2px solid #10b981';
        btn.style.borderRadius = '10px';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        btn.style.whiteSpace = 'nowrap';

        btn.onclick = () => {
          if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización.');
            return;
          }
          setLoadingLocation(true);
          btn.innerHTML = '⏳ Buscando...';
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              if (mapRef.current) {
                mapRef.current.setView([lat, lng], 18);
                if (markerRef.current) {
                  markerRef.current.setLatLng([lat, lng]);
                }
              }
              fetchAddress(lat, lng);
              onLocationChange(lat, lng);
              setLoadingLocation(false);
              btn.innerHTML = '📍 Ubícame';
            },
            (err) => {
              alert(`No se pudo obtener la ubicación: ${err.message}`);
              setLoadingLocation(false);
              btn.innerHTML = '📍 Ubícame';
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        };

        return btn;
      }
    });

    map.addControl(new LocateButton());

    // Manejar evento de localización
    map.on('locationfound', (e) => {
      const { lat, lng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else if (mapRef.current) {
        const newMarker = L.marker([lat, lng], { icon: customIcon }).addTo(mapRef.current);
        markerRef.current = newMarker;
      }

      fetchAddress(lat, lng);
      onLocationChange(lat, lng);
      setLoadingLocation(false);
    });

    map.on('locationerror', () => {
      setLoadingLocation(false);
      alert('No se pudo obtener tu ubicación. Verifica los permisos.');
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
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([nLat, nLng]);
      mapRef.current.setView([nLat, nLng], 18);
    }
  }, [nLat, nLng]);

  if (!isClient) {
    return (
      <div className="h-full w-full bg-[#020617] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">
        Cargando mapa...
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        style={{ minHeight: '100%' }}
      />

      {/* Overlay con dirección */}
      {address && (
        <div className="absolute top-4 left-4 z-[1000] max-w-md bg-[#1a1a1a] border border-blue-500/30 rounded-lg p-2 shadow-lg">
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">UBICACIÓN ACTUAL</p>
          <p className="text-[11px] text-white font-medium truncate">{address}</p>
          <div className="flex gap-2 mt-1 text-[8px] text-slate-500">
            <span>LAT: {nLat.toFixed(6)}</span>
            <span>LON: {nLng.toFixed(6)}</span>
          </div>
          {geocodingStatus === 'loading' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          )}
        </div>
      )}

      {loadingLocation && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[1001]">
          <div className="bg-[#1a1a1a] p-4 rounded-lg border border-blue-500/30">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-xs text-white">Obteniendo ubicación...</p>
          </div>
        </div>
      )}
    </div>
  );
}