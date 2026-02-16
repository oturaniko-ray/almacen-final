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

export default function MapaInteractivo({ lat, lng, onLocationChange }: any) {
  const [isClient, setIsClient] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [address, setAddress] = useState<string>('');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const nLat = parseFloat(lat) || -12.046374;
  const nLng = parseFloat(lng) || -77.042793;

  // Solo renderizar en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Obtener dirección cuando cambian las coordenadas
  useEffect(() => {
    if (nLat !== 0 && nLng !== 0) {
      getAddressFromCoordinates(nLat, nLng).then(addr => {
        if (addr) setAddress(addr);
      });
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
      getAddressFromCoordinates(lat, lng).then(addr => {
        if (addr) setAddress(addr);
      });

      // Notificar cambio
      onLocationChange(lat, lng);
    });

    // Botón para ubicar al usuario
    const LocateButton = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: function() {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        btn.innerHTML = '📍';
        btn.title = 'Mi ubicación';
        btn.style.backgroundColor = 'white';
        btn.style.width = '40px';
        btn.style.height = '40px';
        btn.style.fontSize = '20px';
        btn.style.cursor = 'pointer';
        btn.style.border = '2px solid #3b82f6';
        btn.style.borderRadius = '8px';
        btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        
        btn.onclick = async () => {
          setLoadingLocation(true);
          
          try {
            const location = await getCurrentLocation();
            
            // ✅ VERIFICACIÓN: Asegurar que el mapa existe antes de usarlo
            if (mapRef.current && location) {
              mapRef.current.setView([location.lat, location.lng], 18);
              
              if (markerRef.current) {
                markerRef.current.setLatLng([location.lat, location.lng]);
              }
              
              if (location.address) {
                setAddress(location.address);
              } else {
                const addr = await getAddressFromCoordinates(location.lat, location.lng);
                if (addr) setAddress(addr);
              }
              
              onLocationChange(location.lat, location.lng);
            } else if (!location) {
              alert('No se pudo obtener tu ubicación. Verifica los permisos.');
            }
          } catch (error) {
            console.error('Error getting location:', error);
            alert('Error al obtener ubicación');
          } finally {
            setLoadingLocation(false);
          }
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

      getAddressFromCoordinates(lat, lng).then(addr => {
        if (addr) setAddress(addr);
      });

      onLocationChange(lat, lng);
      setLoadingLocation(false);
    });

    map.on('locationerror', () => {
      setLoadingLocation(false);
      alert('No se pudo obtener tu ubicación. Verifica los permisos.');
    });

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
        style={{ minHeight: '350px' }}
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