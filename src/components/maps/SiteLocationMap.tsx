'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  Check,
  Building2,
  RefreshCw,
  LocateFixed,
  Route
} from 'lucide-react';
import { AddressComponents, GeocodedLocation } from '@/lib/services/location-service';

export interface LocationData {
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: 'ON_SITE' | 'NOT_ON_SITE';
  locationAccuracyMeters?: number;
  isConfirmed: boolean;
  components?: AddressComponents;
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

// Client-side dynamic import of Leaflet map canvas to prevent SSR window reference errors
const LeafletMapCanvas = dynamic(
  () => import('./LeafletMapCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-72 sm:h-80 bg-[#f4ece1] rounded-xl flex flex-col items-center justify-center text-xs text-[#7d6553] space-y-2 border border-[#d6c7b2]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8f6541]" />
        <span className="font-medium">Loading OpenStreetMap Canvas...</span>
      </div>
    ),
  }
);

export function SiteLocationMap({
  initialAddress = '',
  initialLatitude,
  initialLongitude,
  initialLocationType,
  initialLocationAccuracy,
  onLocationChange,
  disabled = false,
}: SiteLocationMapProps) {
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
  const [onSiteComponents, setOnSiteComponents] = useState<AddressComponents | undefined>(undefined);
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
  const [notOnSiteComponents, setNotOnSiteComponents] = useState<AddressComponents | undefined>(undefined);
  const [notOnSiteConfirmed, setNotOnSiteConfirmed] = useState<boolean>(() => {
    return Boolean(initialLocationType === 'NOT_ON_SITE' && initialAddress);
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return initialLocationType === 'NOT_ON_SITE' ? initialAddress : '';
  });

  // Autocomplete suggestions state (Smart Search API)
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Status and feedback
  const [locating, setLocating] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [accuracyWarningMsg, setAccuracyWarningMsg] = useState<string | null>(null);

  // Active coordinates based on selected mode
  const activeCoords = locationType === 'ON_SITE' ? onSiteCoords : notOnSiteCoords;
  const activeAddress = locationType === 'ON_SITE' ? onSiteAddress : notOnSiteAddress;
  const activeConfirmed = locationType === 'ON_SITE' ? onSiteConfirmed : notOnSiteConfirmed;
  const activeComponents = locationType === 'ON_SITE' ? onSiteComponents : notOnSiteComponents;

  // Restore state when initial props update (e.g. edit mode loaded via async fetch)
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

  // Click outside listener for search autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Server-backed Reverse Geocoding with clean address hierarchy
  const reverseGeocode = useCallback(async (lat: number, lng: number, mode: 'ON_SITE' | 'NOT_ON_SITE') => {
    setReverseGeocoding(true);
    try {
      const res = await fetch(`/api/locations/reverse?lat=${lat}&lng=${lng}`);
      const json = await res.json();

      if (json.success && json.data) {
        const data: GeocodedLocation = json.data;
        const resolvedAddress = data.fullAddress;

        if (mode === 'ON_SITE') {
          setOnSiteAddress(resolvedAddress);
          setOnSiteComponents(data.components);
          setOnSiteConfirmed(false);
        } else {
          setNotOnSiteAddress(resolvedAddress);
          setNotOnSiteComponents(data.components);
          setSearchQuery(resolvedAddress);
          setNotOnSiteConfirmed(false);
        }
        setLocationSuccessMsg(`Address resolved: ${resolvedAddress}. Click "Confirm Location" to lock.`);
        return;
      }
      // If server reverse fails, show coordinate string
      const fallbackStr = `Site at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}, Indore, MP`;
      if (mode === 'ON_SITE') {
        setOnSiteAddress(fallbackStr);
      } else {
        setNotOnSiteAddress(fallbackStr);
      }
    } catch {
      setLocationErrorMsg('Could not reverse-geocode address automatically. You may edit the address manually.');
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  // Debounced smart search using `/api/locations/search`
  const handleSearchQueryChange = (val: string) => {
    setSearchQuery(val);
    setNotOnSiteAddress(val);
    setNotOnSiteConfirmed(false);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    // Debounce 350ms for smooth user experience
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Pass current map center / pin for location-biased proximity sorting
        const centerLat = notOnSiteCoords?.lat || onSiteCoords?.lat || 22.7196;
        const centerLng = notOnSiteCoords?.lng || onSiteCoords?.lng || 75.8577;

        const res = await fetch(
          `/api/locations/search?q=${encodeURIComponent(trimmed)}&lat=${centerLat}&lng=${centerLng}`
        );
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
          setShowDropdown(json.data.length > 0);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Select a Smart Search suggestion
  const handleSelectSearchResult = (result: GeocodedLocation) => {
    const lat = result.latitude;
    const lng = result.longitude;
    const formatted = result.fullAddress;

    setNotOnSiteCoords({ lat, lng });
    setNotOnSiteAddress(formatted);
    setNotOnSiteComponents(result.components);
    setSearchQuery(formatted);
    setNotOnSiteConfirmed(false);
    setShowDropdown(false);
    setSearchResults([]);

    setLocationSuccessMsg(`Location found: ${formatted}. Verify pin on OpenStreetMap and click "Confirm Location".`);
  };

  // Handler: "Use Current Location" (On-Site Mode with High-Accuracy Device GPS)
  const handleUseCurrentLocation = () => {
    setLocationErrorMsg(null);
    setLocationSuccessMsg(null);
    setAccuracyWarningMsg(null);

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
        setOnSiteConfirmed(false);
        setLocating(false);

        // Check GPS accuracy: if > 30m, display prominent warning
        if (accuracy > 30) {
          setAccuracyWarningMsg(
            `⚠️ GPS accuracy is ±${accuracy}m (satellite signal may be obstructed by buildings). Please drag the map pin to the exact project entrance.`
          );
        } else {
          setAccuracyWarningMsg(null);
          setLocationSuccessMsg(
            `✓ High-accuracy satellite GPS lock (±${accuracy}m). Resolving meaningful street address...`
          );
        }

        reverseGeocode(lat, lng, 'ON_SITE');
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationErrorMsg('GPS permission was denied. Please allow location access in your browser or choose "Not On-Site" to search the address.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationErrorMsg('GPS satellite signal unavailable. Please retry with a clear view of the sky or switch to "Not On-Site".');
            break;
          case error.TIMEOUT:
            setLocationErrorMsg('GPS location request timed out. Please retry or enter address manually.');
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

  // Handler: Marker dragged to new position
  const handleMarkerDragEnd = useCallback((lat: number, lng: number) => {
    if (locationType === 'ON_SITE') {
      setOnSiteCoords({ lat, lng });
      reverseGeocode(lat, lng, 'ON_SITE');
    } else {
      setNotOnSiteCoords({ lat, lng });
      reverseGeocode(lat, lng, 'NOT_ON_SITE');
    }
    setLocationSuccessMsg(`Marker moved to: ${lat}, ${lng}. Please click "Confirm Location" to lock.`);
  }, [locationType, reverseGeocode]);

  // Handler: Click anywhere on map canvas to reposition pin
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (locationType === 'ON_SITE') {
      setOnSiteCoords({ lat, lng });
      reverseGeocode(lat, lng, 'ON_SITE');
    } else {
      setNotOnSiteCoords({ lat, lng });
      reverseGeocode(lat, lng, 'NOT_ON_SITE');
    }
    setLocationSuccessMsg(`Marker positioned at: ${lat}, ${lng}. Click "Confirm Location" to lock.`);
  }, [locationType, reverseGeocode]);

  // Handler: Confirm Location (Locks the coordinates and notifies parent form)
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
        components: onSiteComponents,
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
        components: notOnSiteComponents,
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
              if (onSiteConfirmed && onSiteAddress && onSiteCoords) {
                onLocationChange({
                  address: onSiteAddress,
                  latitude: onSiteCoords.lat,
                  longitude: onSiteCoords.lng,
                  locationType: 'ON_SITE',
                  locationAccuracyMeters: onSiteAccuracy,
                  isConfirmed: true,
                  components: onSiteComponents,
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
                I am physically standing at the site. Fetch high-accuracy device GPS coordinates and reverse-geocode the nearest street address.
              </p>
            </div>
          </div>

          {/* Option B: Not On-Site */}
          <div
            onClick={() => {
              if (disabled) return;
              setLocationType('NOT_ON_SITE');
              setLocationErrorMsg(null);
              if (notOnSiteConfirmed && notOnSiteAddress) {
                onLocationChange({
                  address: notOnSiteAddress,
                  latitude: notOnSiteCoords ? notOnSiteCoords.lat : undefined,
                  longitude: notOnSiteCoords ? notOnSiteCoords.lng : undefined,
                  locationType: 'NOT_ON_SITE',
                  isConfirmed: true,
                  components: notOnSiteComponents,
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
                I am in office or working remotely. Search house numbers, building names, colonies, and commercial landmarks with nearby suggestions.
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
                    Click the button below to acquire satellite-assisted latitude, longitude, and reverse-geocode the nearest street address.
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

              {/* Poor Accuracy Warning Banner */}
              {accuracyWarningMsg && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{accuracyWarningMsg}</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      You can drag the pin on the map below directly onto the delivery gate to ensure precise logistics.
                    </p>
                  </div>
                </div>
              )}

              {/* Detected Address & Status Box */}
              {onSiteCoords && (
                <div className="p-3.5 bg-white rounded-lg border border-[#ebdcc9] text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8c5e39] flex items-center gap-1">
                        <span>Nearest Meaningful Address</span>
                        {reverseGeocoding && <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#8c5e39]" />}
                      </span>
                      <div className="text-sm font-bold text-[#24160c] mt-0.5 leading-snug">
                        {onSiteAddress || 'Resolving street, colony, and road details...'}
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
                      <span className={`font-sans font-semibold flex items-center gap-1 ${
                        onSiteAccuracy > 30 ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        <LocateFixed className="w-3.5 h-3.5" />
                        Device Accuracy: ±{onSiteAccuracy} metres
                      </span>
                    )}
                  </div>

                  {/* Confirm Location Button */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#f2eadf]">
                    <span className="text-[11px] text-[#7d6553]">
                      Drag the marker on the map to pinpoint the exact scaffold delivery gate, then confirm.
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
          {/* MODE B: NOT ON-SITE INTERFACE (SMART ADDRESS SEARCH)     */}
          {/* ======================================================== */}
          {locationType === 'NOT_ON_SITE' && (
            <div className="p-4 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9] space-y-3.5">
              <div>
                <h4 className="text-xs font-bold text-[#24160c] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#8c5e39]" />
                  <span>Remote Address Search & Nearby Places</span>
                </h4>
                <p className="text-[11px] text-[#7d6553] mt-0.5">
                  Search house number, colony, landmark, street, or commercial complex. Prioritizes exact matches and shows nearby places.
                </p>
              </div>

              {/* Smart Search Input & Autocomplete Dropdown */}
              <div ref={dropdownContainerRef} className="relative">
                <Search className="w-4 h-4 text-[#8c5e39] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  disabled={disabled}
                  value={searchQuery}
                  onChange={(e) => handleSearchQueryChange(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  placeholder="e.g. 820, Khatiwala Tank, Sapphire Square, Sapna Sangeeta, Super Corridor..."
                  className="w-full text-xs pl-9 pr-8 py-2.5 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] placeholder:text-[#9c826e] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
                
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8c5e39] absolute right-3 top-1/2 -translate-y-1/2" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setNotOnSiteAddress('');
                      setSearchResults([]);
                      setShowDropdown(false);
                      setNotOnSiteConfirmed(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                {/* Suggestions Dropdown with Distance and Hierarchy */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#ebdcc9] rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-[#fbf9f5] border-b border-[#ebdcc9] text-[10px] font-bold text-[#8c5e39] uppercase tracking-wider flex items-center justify-between">
                      <span>Matching Places & Nearby Addresses</span>
                      <span>{searchResults.length} results</span>
                    </div>

                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSearchResult(item)}
                        className={`p-3 border-b border-[#f2eadf] hover:bg-[#faf6ee] cursor-pointer transition flex items-start gap-2.5 text-left text-xs ${
                          item.isExactMatch ? 'bg-[#faf6ee]/70' : ''
                        }`}
                      >
                        <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${
                          item.isExactMatch ? 'text-[#16a34a]' : 'text-[#8c5e39]'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#24160c] truncate">
                              {item.title}
                            </span>
                            {item.isExactMatch && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase rounded-sm border border-emerald-300 shrink-0">
                                Exact Match
                              </span>
                            )}
                            {item.distanceKm !== undefined && (
                              <span className="text-[10px] font-mono text-[#7d6553] flex items-center gap-0.5 ml-auto shrink-0">
                                <Route className="w-3 h-3 text-[#8c5e39]" />
                                {item.distanceKm} km away
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#7d6553] truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Remote Address & Confirmation Box */}
              {notOnSiteAddress && (
                <div className="p-3.5 bg-white rounded-lg border border-[#ebdcc9] text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8c5e39] flex items-center gap-1">
                        <span>Selected Project Site Address</span>
                        {reverseGeocoding && <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#8c5e39]" />}
                      </span>
                      <div className="text-sm font-bold text-[#24160c] mt-0.5 leading-snug">
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
          {/* 3. OPENSTREETMAP LEAFLET CANVAS                          */}
          {/* ======================================================== */}
          <div className="relative rounded-xl border border-[#d6c7b2] overflow-hidden bg-[#f4ece1] shadow-2xs">
            <div className="w-full h-64 sm:h-72 md:h-80" style={{ minHeight: '280px' }}>
              <LeafletMapCanvas
                coords={activeCoords}
                onMarkerDragEnd={handleMarkerDragEnd}
                onMapClick={handleMapClick}
                disabled={disabled}
              />
            </div>

            {/* Live GPS Coordinates Overlay */}
            {activeCoords && (
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-[#1c120c]/90 text-white backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#382315] shadow-md flex items-center justify-between sm:justify-start gap-3 text-[11px] font-mono z-20">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#c79e7c] shrink-0" />
                  <span>
                    Lat: <strong className="text-[#fdfcf9]">{activeCoords.lat.toFixed(5)}</strong>, Lng:{' '}
                    <strong className="text-[#fdfcf9]">{activeCoords.lng.toFixed(5)}</strong>
                  </span>
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${activeCoords.lat}&mlon=${activeCoords.lng}#map=17/${activeCoords.lat}/${activeCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c79e7c] hover:text-white flex items-center gap-1 text-[10px] font-sans underline underline-offset-2 ml-2"
                  title="View on OpenStreetMap"
                >
                  <span>OpenStreetMap</span>
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
    </div>
  );
}
