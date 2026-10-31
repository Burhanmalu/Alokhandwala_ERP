'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  MapPin, 
  Navigation, 
  Search, 
  AlertTriangle, 
  Loader2, 
  ExternalLink, 
  CheckCircle2,
  Compass,
  X,
  Layers,
  Check,
  Building2,
  MapPinned,
  ShieldCheck,
  Edit3,
  HelpCircle
} from 'lucide-react';

export interface LocationData {
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: 'ON_SITE' | 'NOT_ON_SITE';
  locationAccuracyMeters?: number;
  isConfirmed: boolean;
}

interface SiteLocationMapProps {
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  initialLocationType?: 'ON_SITE' | 'NOT_ON_SITE';
  initialLocationAccuracy?: number;
  onLocationChange: (data: LocationData) => void;
  disabled?: boolean;
}

// Global script load tracker
let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if (window.google && window.google.maps) return Promise.resolve();

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptPromise;
}

export function SiteLocationMap({
  initialAddress = '',
  initialLatitude,
  initialLongitude,
  initialLocationType,
  initialLocationAccuracy,
  onLocationChange,
  disabled = false,
}: SiteLocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Mode Selection: 'ON_SITE' | 'NOT_ON_SITE' | null
  const [locationType, setLocationType] = useState<'ON_SITE' | 'NOT_ON_SITE' | null>(() => {
    if (initialLocationType) return initialLocationType;
    if (initialLatitude && initialLongitude) return 'ON_SITE';
    return null;
  });

  // State for On-Site Mode
  const [onSiteCoords, setOnSiteCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialLocationType === 'ON_SITE' && initialLatitude && initialLongitude) {
      return { lat: initialLatitude, lng: initialLongitude };
    }
    return null;
  });
  const [onSiteAddress, setOnSiteAddress] = useState<string>(() => {
    return initialLocationType === 'ON_SITE' ? initialAddress : '';
  });
  const [onSiteAccuracy, setOnSiteAccuracy] = useState<number | undefined>(() => {
    return initialLocationType === 'ON_SITE' ? initialLocationAccuracy : undefined;
  });
  const [onSiteConfirmed, setOnSiteConfirmed] = useState<boolean>(() => {
    return Boolean(initialLocationType === 'ON_SITE' && initialLatitude && initialLongitude);
  });

  // State for Not On-Site Mode
  const [notOnSiteCoords, setNotOnSiteCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialLocationType === 'NOT_ON_SITE' && initialLatitude && initialLongitude) {
      return { lat: initialLatitude, lng: initialLongitude };
    }
    return null;
  });
  const [notOnSiteAddress, setNotOnSiteAddress] = useState<string>(() => {
    return initialLocationType === 'NOT_ON_SITE' ? initialAddress : '';
  });
  const [notOnSiteConfirmed, setNotOnSiteConfirmed] = useState<boolean>(() => {
    return Boolean(initialLocationType === 'NOT_ON_SITE' && initialAddress);
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return initialLocationType === 'NOT_ON_SITE' ? initialAddress : '';
  });

  // Common Map States
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Active coordinates based on selected mode
  const activeCoords = locationType === 'ON_SITE' ? onSiteCoords : notOnSiteCoords;
  const activeAddress = locationType === 'ON_SITE' ? onSiteAddress : notOnSiteAddress;
  const activeConfirmed = locationType === 'ON_SITE' ? onSiteConfirmed : notOnSiteConfirmed;

  // Refs for Google Map elements
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderInstanceRef = useRef<google.maps.Geocoder | null>(null);

  // Restore when initial props update (e.g. edit mode loaded via async fetch)
  useEffect(() => {
    if (initialLocationType) {
      setLocationType(initialLocationType);
      if (initialLocationType === 'ON_SITE') {
        if (initialLatitude && initialLongitude) {
          setOnSiteCoords({ lat: initialLatitude, lng: initialLongitude });
          setOnSiteConfirmed(true);
        }
        if (initialAddress) setOnSiteAddress(initialAddress);
        if (initialLocationAccuracy) setOnSiteAccuracy(initialLocationAccuracy);
      } else {
        if (initialLatitude && initialLongitude) {
          setNotOnSiteCoords({ lat: initialLatitude, lng: initialLongitude });
          setNotOnSiteConfirmed(true);
        }
        if (initialAddress) {
          setNotOnSiteAddress(initialAddress);
          setSearchQuery(initialAddress);
        }
      }
    } else if (initialLatitude && initialLongitude && !locationType) {
      setLocationType('ON_SITE');
      setOnSiteCoords({ lat: initialLatitude, lng: initialLongitude });
      setOnSiteAddress(initialAddress);
      setOnSiteConfirmed(true);
    }
  }, [initialLocationType, initialLatitude, initialLongitude, initialAddress, initialLocationAccuracy]);

  // Reverse Geocoding with Google Geocoder (Street-level detail)
  const reverseGeocode = useCallback((lat: number, lng: number, mode: 'ON_SITE' | 'NOT_ON_SITE') => {
    if (!geocoderInstanceRef.current && window.google && window.google.maps) {
      geocoderInstanceRef.current = new window.google.maps.Geocoder();
    }

    if (!geocoderInstanceRef.current) return;

    geocoderInstanceRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) {
        // results[0] gives the most specific street-level/rooftop address
        const fullStreetAddress = results[0].formatted_address;
        if (mode === 'ON_SITE') {
          setOnSiteAddress(fullStreetAddress);
          setOnSiteConfirmed(false); // Requires user to confirm updated marker position
        } else {
          setNotOnSiteAddress(fullStreetAddress);
          setSearchQuery(fullStreetAddress);
          setNotOnSiteConfirmed(false);
        }
      }
    });
  }, []);

  // Fallback reverse geocoding using OpenStreetMap Nominatim with full address details
  const fallbackReverseGeocode = useCallback(async (lat: number, lng: number, mode: 'ON_SITE' | 'NOT_ON_SITE') => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          if (mode === 'ON_SITE') {
            setOnSiteAddress(data.display_name);
            setOnSiteConfirmed(false);
          } else {
            setNotOnSiteAddress(data.display_name);
            setSearchQuery(data.display_name);
            setNotOnSiteConfirmed(false);
          }
          return;
        }
      }
    } catch {
      // Ignore network errors on fallback
    }
  }, []);

  // Update map viewport & marker helper
  const updateMapMarker = useCallback((lat: number, lng: number, zoomLevel = 17) => {
    if (!mapInstanceRef.current || !markerInstanceRef.current || !window.google) return;
    const pos = new window.google.maps.LatLng(lat, lng);
    mapInstanceRef.current.setCenter(pos);
    mapInstanceRef.current.setZoom(zoomLevel);
    markerInstanceRef.current.setPosition(pos);
    markerInstanceRef.current.setVisible(true);
  }, []);

  // Initialize or re-render Google Map when a mode is active
  useEffect(() => {
    let isCancelled = false;

    if (!locationType) return;

    if (!apiKey) {
      setMapError('Google Maps API key not detected. Manual street address entry and high-accuracy device GPS remain fully active.');
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (isCancelled || !mapContainerRef.current) return;

        // Default position: active coords, or India / Central Yard
        const targetPos = activeCoords || { lat: 19.0760, lng: 72.8777 };

        if (!mapInstanceRef.current) {
          const map = new window.google.maps.Map(mapContainerRef.current, {
            center: targetPos,
            zoom: activeCoords ? 17 : 12,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
          });
          mapInstanceRef.current = map;

          const geocoder = new window.google.maps.Geocoder();
          geocoderInstanceRef.current = geocoder;

          const marker = new window.google.maps.Marker({
            position: targetPos,
            map: map,
            draggable: true,
            visible: Boolean(activeCoords),
            title: 'Drag to adjust exact scaffolding delivery / erection gate',
            animation: window.google.maps.Animation.DROP,
          });
          markerInstanceRef.current = marker;

          // Drag listener
          marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            if (pos) {
              const lat = Number(pos.lat().toFixed(6));
              const lng = Number(pos.lng().toFixed(6));
              
              if (locationType === 'ON_SITE') {
                setOnSiteCoords({ lat, lng });
                reverseGeocode(lat, lng, 'ON_SITE');
              } else {
                setNotOnSiteCoords({ lat, lng });
                reverseGeocode(lat, lng, 'NOT_ON_SITE');
              }

              setLocationSuccessMsg(`Marker moved to: ${lat}, ${lng}. Please click "Confirm Location" to lock.`);
            }
          });

          // Click map listener
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              const lat = Number(e.latLng.lat().toFixed(6));
              const lng = Number(e.latLng.lng().toFixed(6));
              marker.setPosition(e.latLng);
              marker.setVisible(true);

              if (locationType === 'ON_SITE') {
                setOnSiteCoords({ lat, lng });
                reverseGeocode(lat, lng, 'ON_SITE');
              } else {
                setNotOnSiteCoords({ lat, lng });
                reverseGeocode(lat, lng, 'NOT_ON_SITE');
              }

              setLocationSuccessMsg(`Marker positioned at: ${lat}, ${lng}. Click "Confirm Location" to lock.`);
            }
          });
        } else {
          // If already instantiated, sync viewport
          if (activeCoords) {
            updateMapMarker(activeCoords.lat, activeCoords.lng, 17);
          }
        }

        // Attach Google Places Autocomplete if in NOT_ON_SITE mode
        if (locationType === 'NOT_ON_SITE' && searchInputRef.current && window.google.maps.places) {
          if (!autocompleteInstanceRef.current) {
            const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
              componentRestrictions: { country: 'in' },
              fields: ['formatted_address', 'geometry', 'name', 'address_components'],
            });
            autocompleteInstanceRef.current = autocomplete;

            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place.geometry && place.geometry.location) {
                const lat = Number(place.geometry.location.lat().toFixed(6));
                const lng = Number(place.geometry.location.lng().toFixed(6));
                const formatted = place.formatted_address || place.name || '';

                setNotOnSiteCoords({ lat, lng });
                setNotOnSiteAddress(formatted);
                setSearchQuery(formatted);
                setNotOnSiteConfirmed(false);

                if (mapInstanceRef.current && markerInstanceRef.current) {
                  updateMapMarker(lat, lng, 17);
                }

                setLocationSuccessMsg(`Place found: ${place.name || formatted}. Check pin and click "Confirm Location".`);
              }
            });
          }
        }

        setMapLoaded(true);
        setMapError(null);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Google Maps Script Note:', err);
          setMapError('Google Maps view unavailable. Manual street address entry and high-accuracy device GPS remain fully active.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [locationType, apiKey, activeCoords, reverseGeocode, updateMapMarker]);

  // Handler: "Use Current Location" (On-Site Mode)
  const handleUseCurrentLocation = () => {
    setLocationErrorMsg(null);
    setLocationSuccessMsg(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationErrorMsg('Geolocation is not supported by your current browser.');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const accuracy = Math.round(position.coords.accuracy);

        setOnSiteCoords({ lat, lng });
        setOnSiteAccuracy(accuracy);
        setOnSiteConfirmed(false); // User must review street address and click "Confirm Location"
        setLocating(false);

        setLocationSuccessMsg(
          `On-site GPS detected (device accuracy: ±${accuracy}m). Reverse-geocoding street address...`
        );

        if (mapInstanceRef.current && markerInstanceRef.current && window.google) {
          updateMapMarker(lat, lng, 17);
          reverseGeocode(lat, lng, 'ON_SITE');
        } else {
          fallbackReverseGeocode(lat, lng, 'ON_SITE');
        }
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationErrorMsg('Location permission was denied. Please allow GPS access or switch to "Not On-Site" mode to search the address.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationErrorMsg('GPS satellite signal unavailable. Please retry or switch to "Not On-Site" mode.');
            break;
          case error.TIMEOUT:
            setLocationErrorMsg('GPS location request timed out. Please retry with a clear view of the sky or enter manually.');
            break;
          default:
            setLocationErrorMsg('Unable to capture current location. Please verify device location settings.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Handler: Confirm Location (Locks the coordinates and informs the parent form)
  const handleConfirmLocation = () => {
    if (locationType === 'ON_SITE') {
      if (!onSiteCoords) {
        setLocationErrorMsg('Please click "Use Current Location" first to detect GPS position.');
        return;
      }
      if (!onSiteAddress.trim()) {
        setLocationErrorMsg('Please enter or verify the street-level site address before confirming.');
        return;
      }

      setOnSiteConfirmed(true);
      onLocationChange({
        address: onSiteAddress.trim(),
        latitude: onSiteCoords.lat,
        longitude: onSiteCoords.lng,
        locationType: 'ON_SITE',
        locationAccuracyMeters: onSiteAccuracy,
        isConfirmed: true,
      });

      setLocationSuccessMsg(`✓ On-Site location confirmed: ${onSiteAddress}`);
      setTimeout(() => setLocationSuccessMsg(null), 4000);
    } else if (locationType === 'NOT_ON_SITE') {
      if (!notOnSiteAddress.trim()) {
        setLocationErrorMsg('Please search or type the site address before confirming.');
        return;
      }

      setNotOnSiteConfirmed(true);
      onLocationChange({
        address: notOnSiteAddress.trim(),
        latitude: notOnSiteCoords ? notOnSiteCoords.lat : undefined,
        longitude: notOnSiteCoords ? notOnSiteCoords.lng : undefined,
        locationType: 'NOT_ON_SITE',
        isConfirmed: true,
      });

      setLocationSuccessMsg(`✓ Remote site location confirmed: ${notOnSiteAddress}`);
      setTimeout(() => setLocationSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Location Type Selector (Two Distinct Radio/Card Options) */}
      <div>
        <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
          Select Location Capture Method <span className="text-rose-600">*</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A: On-Site */}
          <div
            onClick={() => {
              if (disabled) return;
              setLocationType('ON_SITE');
              setLocationErrorMsg(null);
              // If already confirmed in onSite, notify parent
              if (onSiteConfirmed && onSiteAddress && onSiteCoords) {
                onLocationChange({
                  address: onSiteAddress,
                  latitude: onSiteCoords.lat,
                  longitude: onSiteCoords.lng,
                  locationType: 'ON_SITE',
                  locationAccuracyMeters: onSiteAccuracy,
                  isConfirmed: true,
                });
              }
            }}
            className={`p-4 rounded-xl border-2 transition cursor-pointer select-none text-left flex items-start gap-3 ${
              locationType === 'ON_SITE'
                ? 'border-[#24160c] bg-[#fbf9f5] shadow-xs ring-1 ring-[#8c5e39]/20'
                : 'border-[#ebdcc9] bg-white hover:border-[#8c5e39]/50 hover:bg-[#faf6ee]/40'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
              locationType === 'ON_SITE' ? 'border-[#24160c] bg-[#24160c]' : 'border-[#d6c7b2] bg-white'
            }`}>
              {locationType === 'ON_SITE' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Navigation className={`w-4 h-4 ${locationType === 'ON_SITE' ? 'text-[#8c5e39]' : 'text-[#9c826e]'}`} />
                <span className="font-bold text-xs text-[#24160c]">On-Site</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ebdcc9] text-[#24160c] font-semibold">
                  Device GPS
                </span>
              </div>
              <p className="text-[11px] text-[#7d6553] mt-1 leading-relaxed">
                I am physically standing at the site. Fetch high-accuracy GPS coordinates and reverse-geocode the exact street address.
              </p>
            </div>
          </div>

          {/* Option B: Not On-Site */}
          <div
            onClick={() => {
              if (disabled) return;
              setLocationType('NOT_ON_SITE');
              setLocationErrorMsg(null);
              // If already confirmed in notOnSite, notify parent
              if (notOnSiteConfirmed && notOnSiteAddress) {
                onLocationChange({
                  address: notOnSiteAddress,
                  latitude: notOnSiteCoords ? notOnSiteCoords.lat : undefined,
                  longitude: notOnSiteCoords ? notOnSiteCoords.lng : undefined,
                  locationType: 'NOT_ON_SITE',
                  isConfirmed: true,
                });
              }
            }}
            className={`p-4 rounded-xl border-2 transition cursor-pointer select-none text-left flex items-start gap-3 ${
              locationType === 'NOT_ON_SITE'
                ? 'border-[#24160c] bg-[#fbf9f5] shadow-xs ring-1 ring-[#8c5e39]/20'
                : 'border-[#ebdcc9] bg-white hover:border-[#8c5e39]/50 hover:bg-[#faf6ee]/40'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
              locationType === 'NOT_ON_SITE' ? 'border-[#24160c] bg-[#24160c]' : 'border-[#d6c7b2] bg-white'
            }`}>
              {locationType === 'NOT_ON_SITE' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Building2 className={`w-4 h-4 ${locationType === 'NOT_ON_SITE' ? 'text-[#8c5e39]' : 'text-[#9c826e]'}`} />
                <span className="font-bold text-xs text-[#24160c]">Not On-Site</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ebdcc9] text-[#24160c] font-semibold">
                  Remote Search
                </span>
              </div>
              <p className="text-[11px] text-[#7d6553] mt-1 leading-relaxed">
                I am in office or working remotely. Search building names, street addresses, and landmarks via Google Places Autocomplete.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Content When Mode is Selected */}
      {locationType && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          
          {/* ======================================================== */}
          {/* MODE A: ON-SITE INTERFACE                                */}
          {/* ======================================================== */}
          {locationType === 'ON_SITE' && (
            <div className="p-4 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9] space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#24160c] uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-[#8c5e39]" />
                    <span>On-Site GPS Location Capture</span>
                  </h4>
                  <p className="text-[11px] text-[#7d6553] mt-0.5">
                    Click the button below to acquire satellite-assisted latitude, longitude, and street-level reverse geocoding.
                  </p>
                </div>

                {/* Use Current Location Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating || disabled}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#24160c] hover:bg-[#382315] disabled:bg-[#d6c7b2] text-[#fdfcf9] text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  {locating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c79e7c]" />
                      <span>Detecting High-Accuracy GPS...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5 text-[#c79e7c]" />
                      <span>Use Current Location</span>
                    </>
                  )}
                </button>
              </div>

              {/* Detected Address & Status Box */}
              {onSiteCoords && (
                <div className="p-3.5 bg-white rounded-lg border border-[#ebdcc9] text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8c5e39]">
                        Detected Street-Level Address
                      </span>
                      <div className="text-sm font-semibold text-[#24160c] mt-0.5">
                        {onSiteAddress || 'Resolving street, building, and road details...'}
                      </div>
                    </div>
                    {onSiteConfirmed ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-emerald-700" /> Confirmed
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                        Pending Confirmation
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#f2eadf] text-[11px] font-mono text-[#5c3e24]">
                    <span>Lat: <strong>{onSiteCoords.lat.toFixed(6)}</strong></span>
                    <span>Lng: <strong>{onSiteCoords.lng.toFixed(6)}</strong></span>
                    {onSiteAccuracy !== undefined && (
                      <span className="text-[#8c5e39] font-sans font-medium">
                        Device Accuracy: ±{onSiteAccuracy} meters
                      </span>
                    )}
                  </div>

                  {/* Confirm Location Button */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#f2eadf]">
                    <span className="text-[11px] text-[#7d6553]">
                      Drag the map pin below if the delivery gate is slightly different, then confirm.
                    </span>

                    <button
                      type="button"
                      onClick={handleConfirmLocation}
                      disabled={disabled}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0 ${
                        onSiteConfirmed
                          ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                          : 'bg-[#24160c] text-[#fdfcf9] hover:bg-[#382315]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-[#c79e7c]" />
                      <span>{onSiteConfirmed ? 'Location Confirmed ✓' : 'Confirm Location'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE B: NOT ON-SITE INTERFACE (REMOTE PLACES SEARCH)     */}
          {/* ======================================================== */}
          {locationType === 'NOT_ON_SITE' && (
            <div className="p-4 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9] space-y-3.5">
              <div>
                <h4 className="text-xs font-bold text-[#24160c] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#8c5e39]" />
                  <span>Remote Address Search (Google Places Autocomplete)</span>
                </h4>
                <p className="text-[11px] text-[#7d6553] mt-0.5">
                  Type building name, plot number, commercial complex, or street. Select from Google recommendations.
                </p>
              </div>

              {/* Google Places Autocomplete Field */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8c5e39] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  disabled={disabled}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setNotOnSiteAddress(e.target.value);
                    setNotOnSiteConfirmed(false);
                  }}
                  placeholder="e.g. Sapphire Square Indore, Oberoi Sky City Borivali, DLF Phase 3..."
                  className="w-full text-xs pl-9 pr-8 py-2.5 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] placeholder:text-[#9c826e] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setNotOnSiteAddress('');
                      setNotOnSiteConfirmed(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selected Remote Address & Confirmation Box */}
              {notOnSiteAddress && (
                <div className="p-3.5 bg-white rounded-lg border border-[#ebdcc9] text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8c5e39]">
                        Selected Site Address
                      </span>
                      <div className="text-sm font-semibold text-[#24160c] mt-0.5">
                        {notOnSiteAddress}
                      </div>
                    </div>
                    {notOnSiteConfirmed ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-emerald-700" /> Confirmed
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                        Pending Confirmation
                      </span>
                    )}
                  </div>

                  {notOnSiteCoords && (
                    <div className="flex items-center gap-3 pt-1 border-t border-[#f2eadf] text-[11px] font-mono text-[#5c3e24]">
                      <span>Lat: <strong>{notOnSiteCoords.lat.toFixed(6)}</strong></span>
                      <span>Lng: <strong>{notOnSiteCoords.lng.toFixed(6)}</strong></span>
                    </div>
                  )}

                  {/* Confirm Location Button */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#f2eadf]">
                    <span className="text-[11px] text-[#7d6553]">
                      Drag the marker on the map to fine-tune the gate location, then confirm.
                    </span>

                    <button
                      type="button"
                      onClick={handleConfirmLocation}
                      disabled={disabled}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0 ${
                        notOnSiteConfirmed
                          ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                          : 'bg-[#24160c] text-[#fdfcf9] hover:bg-[#382315]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-[#c79e7c]" />
                      <span>{notOnSiteConfirmed ? 'Location Confirmed ✓' : 'Confirm Location'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback Alerts */}
          {locationSuccessMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{locationSuccessMsg}</span>
            </div>
          )}

          {locationErrorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{locationErrorMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. GOOGLE MAP CANVAS (Rendered only when mode selected)  */}
          {/* ======================================================== */}
          <div className="relative rounded-xl border border-[#d6c7b2] overflow-hidden bg-[#f4ece1] shadow-2xs">
            <div
              ref={mapContainerRef}
              className="w-full h-64 sm:h-72 md:h-80"
              style={{ minHeight: '260px' }}
            />

            {/* Fallback Notice when API key is missing */}
            {!mapLoaded && mapError && (
              <div className="absolute inset-0 bg-[#fbf9f5]/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-xs space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#ebdcc9] text-[#24160c] flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-[#8f6541]" />
                </div>
                <div className="font-bold text-[#24160c]">Interactive Map Canvas Ready</div>
                <p className="text-[#7d6553] max-w-md leading-relaxed text-[11px]">
                  {mapError}
                </p>
                {locationType === 'ON_SITE' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={locating}
                      className="px-3.5 py-1.5 bg-[#24160c] text-white rounded-md text-xs font-semibold hover:bg-[#382315] transition flex items-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#c79e7c]" />
                      <span>Capture Device GPS Coordinates</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Live GPS Coordinates Overlay */}
            {activeCoords && (
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-[#1c120c]/90 text-white backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#382315] shadow-md flex items-center justify-between sm:justify-start gap-3 text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#c79e7c] shrink-0" />
                  <span>
                    Lat: <strong className="text-[#fdfcf9]">{activeCoords.lat.toFixed(5)}</strong>, Lng:{' '}
                    <strong className="text-[#fdfcf9]">{activeCoords.lng.toFixed(5)}</strong>
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${activeCoords.lat},${activeCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c79e7c] hover:text-white flex items-center gap-1 text-[10px] font-sans underline underline-offset-2 ml-2"
                  title="Open coordinates in Google Maps"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Interactive Instructions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[#7d6553] pt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8f6541]"></span>
              <span>Click anywhere on the map or drag the pin to pinpoint the exact scaffold delivery gate.</span>
            </span>
            {activeConfirmed ? (
              <span className="font-semibold text-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3" /> Location confirmed and ready to save
              </span>
            ) : (
              <span className="font-semibold text-amber-800">
                Pin moved. Please click &quot;Confirm Location&quot; to apply.
              </span>
            )}
          </div>
        </div>
      )}

      {/* When no mode is selected yet */}
      {!locationType && (
        <div className="p-6 border-2 border-dashed border-[#ebdcc9] rounded-xl text-center bg-[#fbf9f5] space-y-1.5 text-xs text-[#7d6553]">
          <MapPinned className="w-8 h-8 text-[#8c5e39] mx-auto opacity-70 mb-1" />
          <p className="font-bold text-[#24160c]">Choose Location Capture Method to Open Map</p>
          <p className="text-[11px] text-[#8c7360]">
            Select <strong className="text-[#24160c]">On-Site</strong> if you are standing at the project site with mobile GPS, or <strong className="text-[#24160c]">Not On-Site</strong> to search landmarks and addresses remotely.
          </p>
        </div>
      )}
    </div>
  );
}
