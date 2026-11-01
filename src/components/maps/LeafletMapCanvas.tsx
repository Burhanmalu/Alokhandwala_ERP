'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export interface LeafletMapCanvasProps {
  coords: { lat: number; lng: number } | null;
  onMarkerDragEnd: (lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  disabled?: boolean;
}

// Custom High-DPI Scaffold Site Delivery Pin Icon
const scaffoldPinIcon = L.divIcon({
  className: 'scaffold-map-pin',
  html: `
    <div style="position:relative; width:34px; height:44px; transform:translate(-17px, -44px); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); cursor: grab;">
      <svg viewBox="0 0 34 44" width="34" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.61 0 0 7.61 0 17C0 28.5 17 44 17 44S34 28.5 34 17C34 7.61 26.39 0 17 0Z" fill="#24160c"/>
        <path d="M17 2C8.716 2 2 8.716 2 17C2 26.8 17 41.5 17 41.5S32 26.8 32 17C32 8.716 25.284 2 17 2Z" fill="#382315"/>
        <circle cx="17" cy="16" r="7.5" fill="#dfcbab"/>
        <circle cx="17" cy="16" r="4" fill="#24160c"/>
      </svg>
    </div>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

// Helper component to smoothly center/fly map when external coords change
function MapController({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size on initial mount in case container was rendered during tab transition
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (coords && coords.lat && coords.lng) {
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 16), {
        duration: 0.8,
      });
    }
  }, [coords, map]);

  return null;
}

// Helper component for map clicks
function MapClickHandler({
  onMapClick,
  disabled,
}: {
  onMapClick: (lat: number, lng: number) => void;
  disabled?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onMapClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

export default function LeafletMapCanvas({
  coords,
  onMarkerDragEnd,
  onMapClick,
  disabled = false,
}: LeafletMapCanvasProps) {
  // Default to Indore, Madhya Pradesh if no coords yet
  const defaultCenter = useMemo<[number, number]>(() => {
    if (coords && coords.lat && coords.lng) {
      return [coords.lat, coords.lng];
    }
    return [22.7196, 75.8577]; // Indore, MP center
  }, [coords]);

  const markerRef = useRef<L.Marker | null>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          onMarkerDragEnd(Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6)));
        }
      },
    }),
    [onMarkerDragEnd]
  );

  return (
    <div className="w-full h-full relative" style={{ minHeight: '280px', height: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={coords ? 17 : 13}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ minHeight: '280px', height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController coords={coords} />
        <MapClickHandler onMapClick={onMapClick} disabled={disabled} />

        {coords && coords.lat && coords.lng && (
          <Marker
            ref={markerRef}
            position={[coords.lat, coords.lng]}
            icon={scaffoldPinIcon}
            draggable={!disabled}
            eventHandlers={eventHandlers}
          />
        )}
      </MapContainer>
    </div>
  );
}

