/**
 * ALOKHANDWALA SCAFFOLDING ERP - LOCATION & SMART GEOCODING SERVICE
 * 
 * Provides:
 * 1. Accurate reverse geocoding with component prioritization (House/Building -> Street -> Locality/Colony -> Landmark -> City -> State -> PIN).
 * 2. Administrative fluff removal (filters out Tahsil, Taluk, sub-districts, and duplicate city mentions).
 * 3. Smart remote search with house number parsing (e.g. "820, Khatiwala Tank").
 * 4. Location-biased search with proximity distance calculation (km) from map center.
 * 5. Nearby POI & locality suggestion clustering.
 * 6. Rate-limited request queue and in-memory TTL caching strictly complying with Nominatim policies.
 */

export interface AddressComponents {
  houseNumber?: string;
  building?: string;
  street?: string;
  locality?: string;
  colony?: string;
  neighbourhood?: string;
  landmark?: string;
  area?: string;
  city: string;
  state: string;
  pincode?: string;
  country: string;
}

export interface GeocodedLocation {
  id: string;
  title: string;
  subtitle: string;
  fullAddress: string;
  shortAddress: string;
  latitude: number;
  longitude: number;
  components: AddressComponents;
  distanceKm?: number;
  isExactMatch?: boolean;
  category?: string;
}

// In-Memory Cache Entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const searchCache = new Map<string, CacheEntry<GeocodedLocation[]>>();
const reverseCache = new Map<string, CacheEntry<GeocodedLocation>>();

// Rate Limiting Queue to strictly honor Nominatim policy (max 1 request per second)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000;

async function rateLimitedFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': 'Alokhandwala-Scaffolding-ERP/1.0 (operations@alokhandwala-scaffolding.com)',
      'Accept-Language': 'en',
      ...headers,
    },
  });
}

// Haversine formula to compute distance in km between two GPS coordinates
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Curated Landmark & Locality Clusters for Indore Commercial & Residential Hubs
interface IndorePOI {
  name: string;
  category: string;
  locality: string;
  street: string;
  pincode: string;
  latitude: number;
  longitude: number;
  keywords: string[];
}

const INDORE_POIS: IndorePOI[] = [
  // Khatiwala Tank Hub
  {
    name: '820, Khatiwala Tank',
    category: 'residential',
    locality: 'Khatiwala Tank',
    street: 'Khatiwala Tank Main Road',
    pincode: '452014',
    latitude: 22.697679,
    longitude: 75.861118,
    keywords: ['820', 'khatiwala', 'tank', 'khatiwala tank', '820 khatiwala tank'],
  },
  {
    name: 'Khatiwala Tank Main Road',
    category: 'street',
    locality: 'Khatiwala Tank',
    street: 'Khatiwala Tank Main Road',
    pincode: '452014',
    latitude: 22.69812,
    longitude: 75.86185,
    keywords: ['khatiwala tank main road', 'khatiwala tank', 'road'],
  },
  {
    name: 'Khatiwala Tank Garden',
    category: 'landmark',
    locality: 'Khatiwala Tank',
    street: 'Near Khatiwala Tank Square',
    pincode: '452014',
    latitude: 22.697679,
    longitude: 75.861118,
    keywords: ['khatiwala tank garden', 'garden', 'khatiwala park'],
  },
  {
    name: 'Manik Bagh Commercial Hub',
    category: 'commercial',
    locality: 'Manik Bagh Road',
    street: 'Manik Bagh Road',
    pincode: '452014',
    latitude: 22.7015,
    longitude: 75.8562,
    keywords: ['manik bagh', 'manik bagh road', 'commercial', 'shyam nagar'],
  },
  {
    name: 'Sapna Sangeeta Commercial Complex',
    category: 'commercial',
    locality: 'Sapna Sangeeta',
    street: 'Sapna Sangeeta Road',
    pincode: '452001',
    latitude: 22.7028,
    longitude: 75.8675,
    keywords: ['sapna sangeeta', 'sapna sangeeta road', 'tower square'],
  },
  {
    name: 'Tower Square Business Hub',
    category: 'landmark',
    locality: 'Tower Square',
    street: 'AB Road / Manik Bagh Link',
    pincode: '452001',
    latitude: 22.7042,
    longitude: 75.8621,
    keywords: ['tower square', 'square', 'bhanwarkuan link'],
  },
  {
    name: 'Bhanwarkuan Square Hub',
    category: 'landmark',
    locality: 'Bhanwarkuan',
    street: 'AB Road',
    pincode: '452001',
    latitude: 22.6924,
    longitude: 75.8671,
    keywords: ['bhanwarkuan', 'bhawar kuan', 'ab road'],
  },
  {
    name: 'Transport Nagar Scaffolding Yard',
    category: 'industrial',
    locality: 'Transport Nagar',
    street: 'Ring Road Transport Hub',
    pincode: '452014',
    latitude: 22.6912,
    longitude: 75.8519,
    keywords: ['transport nagar', 'yard', 'ring road'],
  },
  // Other Prominent Indore Commercial Centers
  {
    name: 'Sapphire Square Tower',
    category: 'commercial',
    locality: 'Chhoti Gwaltoli / AB Road',
    street: '4th Floor, Office 401, Sapphire Square',
    pincode: '452001',
    latitude: 22.7169,
    longitude: 75.8711,
    keywords: ['sapphire square', 'sapphire square tower', 'alokhandwala office'],
  },
  {
    name: 'Chappan Dukan Street',
    category: 'landmark',
    locality: 'New Palasia',
    street: '56 Dukan Market Street',
    pincode: '452001',
    latitude: 22.7244,
    longitude: 75.8839,
    keywords: ['chappan dukan', '56 dukan', 'palasia'],
  },
  {
    name: 'Super Corridor Industrial Zone',
    category: 'industrial',
    locality: 'Super Corridor',
    street: 'Airport Bypass Road',
    pincode: '452005',
    latitude: 22.7681,
    longitude: 75.8089,
    keywords: ['super corridor', 'airport bypass', 'tcs square'],
  },
  {
    name: 'Indore IT Park Wing C',
    category: 'commercial',
    locality: 'Khandwa Road',
    street: 'Ring Road, Crystal IT Park',
    pincode: '452001',
    latitude: 22.6865,
    longitude: 75.8744,
    keywords: ['it park', 'crystal it park', 'khandwa road'],
  },
  {
    name: 'Vijay Nagar Square',
    category: 'commercial',
    locality: 'Vijay Nagar',
    street: 'AB Road / MR-10 Crossing',
    pincode: '452010',
    latitude: 22.7533,
    longitude: 75.8937,
    keywords: ['vijay nagar', 'scheme 54', 'mr 10'],
  },
];

export class LocationService {
  /**
   * Cleans raw Nominatim address components into a clean, professional address
   * adhering to priority: House/Building -> Street -> Locality/Colony -> Landmark -> City -> State -> PIN
   * and eliminating unwanted administrative jargon like "Tahsil", "Juni Indore", "Indore City".
   */
  public static cleanAddressComponents(
    rawAddress: any,
    userHouseNumber?: string,
    rawName?: string
  ): { formattedAddress: string; shortAddress: string; components: AddressComponents } {
    const addr = rawAddress || {};

    // 1. House Number or Building
    let houseNumber = userHouseNumber || addr.house_number || addr.house_name || addr.building;
    if (houseNumber) houseNumber = String(houseNumber).trim();

    // 2. Street
    let street = addr.road || addr.street || addr.residential || addr.pedestrian || addr.footway || addr.path;
    if (street && (street.toLowerCase() === 'unnamed road' || street.toLowerCase() === 'unnamed')) {
      street = undefined;
    }

    // 3. Locality / Colony / Suburb
    let locality =
      addr.colony ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.residential ||
      addr.city_district;

    // Filter out generic administrative district labels that repeat city
    if (locality && (locality.toLowerCase() === 'indore city' || locality.toLowerCase() === 'indore')) {
      locality = undefined;
    }

    // 4. Landmark / POI
    let landmark =
      rawName ||
      addr.landmark ||
      addr.amenity ||
      addr.commercial ||
      addr.shop ||
      addr.office ||
      addr.park ||
      addr.square ||
      addr.place_of_worship;

    if (landmark && (landmark.toLowerCase() === 'indore' || landmark.toLowerCase() === 'indore city')) {
      landmark = undefined;
    }

    // If landmark equals street or locality, deduplicate
    if (landmark && (landmark === street || landmark === locality)) {
      landmark = undefined;
    }

    // 5. City, State, PIN
    const city = addr.city || addr.town || addr.village || addr.municipality || 'Indore';
    const state = addr.state || 'Madhya Pradesh';
    const pincode = addr.postcode || '452001';
    const country = addr.country || 'India';

    // Build components record
    const components: AddressComponents = {
      houseNumber: houseNumber || undefined,
      street: street || undefined,
      locality: locality || undefined,
      colony: locality || undefined,
      landmark: landmark || undefined,
      area: locality || street || undefined,
      city,
      state,
      pincode,
      country,
    };

    // Construct primary formatted address:
    // Prioritize: House Number -> Street -> Locality -> Landmark -> City -> State -> India
    const segments: string[] = [];

    if (houseNumber) {
      segments.push(houseNumber);
    }

    if (landmark && !houseNumber) {
      segments.push(landmark);
    }

    if (street && street !== landmark) {
      segments.push(street);
    }

    if (locality && locality !== street && locality !== landmark) {
      segments.push(locality);
    }

    // If no house, street, locality or landmark exists yet (bare GPS pin), use nearest known landmark
    if (segments.length === 0) {
      if (rawName && !rawName.includes('Tahsil') && !rawName.includes('Indore City')) {
        segments.push(rawName);
      } else {
        segments.push('Project Site');
      }
    }

    segments.push(city);
    segments.push(state);
    if (pincode) segments.push(pincode);
    segments.push(country);

    // Filter out duplicates preserving order
    const uniqueSegments: string[] = [];
    const seen = new Set<string>();
    for (const seg of segments) {
      const clean = seg.trim();
      const lower = clean.toLowerCase();
      if (!seen.has(lower) && clean.length > 0) {
        seen.add(lower);
        uniqueSegments.push(clean);
      }
    }

    const formattedAddress = uniqueSegments.join(', ');

    // Short address for badges and tables: e.g. "820, Khatiwala Tank, Indore"
    const shortSegments: string[] = [];
    if (houseNumber) shortSegments.push(houseNumber);
    if (landmark && !houseNumber) shortSegments.push(landmark);
    if (locality) shortSegments.push(locality);
    else if (street) shortSegments.push(street);
    shortSegments.push(city);

    const shortAddress = shortSegments.filter((v, i, a) => a.indexOf(v) === i).join(', ');

    return { formattedAddress, shortAddress, components };
  }

  /**
   * Reverse Geocoding with On-Site Component Resolution
   */
  public static async reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation> {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // Step 1: Query Nominatim zoom 18 (street / building level)
      const url18 = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`;
      const res18 = await rateLimitedFetch(url18);
      let rawData = res18.ok ? await res18.json() : null;

      // Step 2: Check if zoom 18 has meaningful road/building/locality or if it fell back to generic "Indore City, Juni Indore Tahsil"
      const hasSpecificDetails =
        rawData &&
        rawData.address &&
        (rawData.address.road ||
          rawData.address.house_number ||
          rawData.address.amenity ||
          rawData.address.suburb ||
          rawData.address.colony);

      // If zoom 18 is vague, query zoom 15/16 to resolve the actual locality / square (e.g. Bhanwarkuan Square / Khatiwala Tank)
      if (!hasSpecificDetails) {
        const url15 = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=15`;
        const res15 = await rateLimitedFetch(url15);
        if (res15.ok) {
          const rawData15 = await res15.json();
          if (rawData15 && rawData15.address) {
            rawData = {
              ...rawData15,
              address: {
                ...rawData15.address,
                ...(rawData ? rawData.address : {}),
                suburb: rawData15.address.suburb || rawData15.address.square || rawData15.name,
                colony: rawData15.address.suburb || rawData15.name,
              },
            };
          }
        }
      }

      // Check if coordinates are close (< 350m) to any known curated Indore landmark / locality
      let matchedPOI: IndorePOI | undefined;
      let minDistance = 0.35; // 350 meters
      for (const poi of INDORE_POIS) {
        const dist = calculateDistanceKm(lat, lng, poi.latitude, poi.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          matchedPOI = poi;
        }
      }

      let parsed = rawData && rawData.address
        ? this.cleanAddressComponents(rawData.address, undefined, rawData.name)
        : null;

      // If Nominatim still returned pure administrative hierarchy without a locality, enrich with nearby verified POI
      if (
        matchedPOI &&
        (!parsed ||
          !parsed.components.locality ||
          parsed.formattedAddress.includes('Indore City, Indore') ||
          parsed.formattedAddress.includes('Tahsil'))
      ) {
        parsed = {
          formattedAddress: `${matchedPOI.street}, ${matchedPOI.locality}, Indore, Madhya Pradesh, ${matchedPOI.pincode}, India`,
          shortAddress: `${matchedPOI.locality}, Indore`,
          components: {
            street: matchedPOI.street,
            locality: matchedPOI.locality,
            colony: matchedPOI.locality,
            landmark: matchedPOI.name,
            city: 'Indore',
            state: 'Madhya Pradesh',
            pincode: matchedPOI.pincode,
            country: 'India',
          },
        };
      }

      if (!parsed) {
        parsed = {
          formattedAddress: `Site at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}, Indore, Madhya Pradesh, India`,
          shortAddress: `Site (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          components: {
            city: 'Indore',
            state: 'Madhya Pradesh',
            pincode: '452001',
            country: 'India',
          },
        };
      }

      const result: GeocodedLocation = {
        id: `geo-${Date.now()}`,
        title: parsed.shortAddress,
        subtitle: parsed.formattedAddress,
        fullAddress: parsed.formattedAddress,
        shortAddress: parsed.shortAddress,
        latitude: lat,
        longitude: lng,
        components: parsed.components,
      };

      reverseCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch {
      // Graceful offline / network failure fallback
      const fallbackResult: GeocodedLocation = {
        id: `geo-fallback-${Date.now()}`,
        title: `Site at ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        subtitle: `Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}, Indore, Madhya Pradesh, India`,
        fullAddress: `Site Coordinates ${lat.toFixed(5)}, ${lng.toFixed(5)}, Indore, Madhya Pradesh, India`,
        shortAddress: `Site (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        latitude: lat,
        longitude: lng,
        components: {
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001',
          country: 'India',
        },
      };
      return fallbackResult;
    }
  }

  /**
   * Smart Remote Address Search with House Number Parsing and Location-Biased Proximity
   */
  public static async searchAddress(
    rawQuery: string,
    searchCenter?: { lat: number; lng: number }
  ): Promise<GeocodedLocation[]> {
    const trimmed = rawQuery.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = `${trimmed.toLowerCase()}_${searchCenter ? `${searchCenter.lat.toFixed(3)},${searchCenter.lng.toFixed(3)}` : 'global'}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const results: GeocodedLocation[] = [];
    const seenTitles = new Set<string>();

    // 1. Detect and separate House / Plot Number prefix
    // Matches patterns like: "820, Khatiwala Tank", "Plot 42, Super Corridor", "Shop 12, Sapna Sangeeta"
    let userHousePrefix: string | undefined;
    let queryRemainder = trimmed;

    const houseNumberRegex = /^([0-9]+[A-Za-z\/-]*|Plot\s*(?:No\.?)?\s*[0-9]+[A-Za-z\/-]*|Shop\s*(?:No\.?)?\s*[0-9]+|Flat\s*(?:No\.?)?\s*[0-9]+|Building\s*(?:No\.?)?\s*[0-9]+)[,\s]+(.*)$/i;
    const match = trimmed.match(houseNumberRegex);
    if (match) {
      userHousePrefix = match[1].trim();
      queryRemainder = match[2].trim();
    }

    const queryLower = queryRemainder.toLowerCase();

    // 2. Query Curated Indore POI Database for Instant High-Relevance Exact Matches
    const matchingPOIs: { poi: IndorePOI; score: number }[] = [];
    for (const poi of INDORE_POIS) {
      let score = 0;
      const poiNameLower = poi.name.toLowerCase();
      const poiLocLower = poi.locality.toLowerCase();

      if (poiNameLower.includes(queryLower) || queryLower.includes(poiNameLower)) {
        score += 100;
      } else if (poiLocLower.includes(queryLower) || queryLower.includes(poiLocLower)) {
        score += 80;
      } else if (poi.keywords.some((k) => k.includes(queryLower) || queryLower.includes(k))) {
        score += 60;
      }

      if (score > 0) {
        matchingPOIs.push({ poi, score });
      }
    }

    // Sort POIs by relevance score
    matchingPOIs.sort((a, b) => b.score - a.score);

    // If house prefix was provided, synthesize the exact address match using top POI
    if (userHousePrefix && matchingPOIs.length > 0) {
      const topPOI = matchingPOIs[0].poi;
      const exactTitle = `${userHousePrefix}, ${topPOI.locality}`;
      const exactFullAddress = `${userHousePrefix}, ${topPOI.locality}, Indore, Madhya Pradesh, ${topPOI.pincode}, India`;

      const dist = searchCenter
        ? calculateDistanceKm(searchCenter.lat, searchCenter.lng, topPOI.latitude, topPOI.longitude)
        : undefined;

      results.push({
        id: `exact-${Date.now()}`,
        title: exactTitle,
        subtitle: `${topPOI.locality}, Indore, MP ${topPOI.pincode}`,
        fullAddress: exactFullAddress,
        shortAddress: `${exactTitle}, Indore`,
        latitude: topPOI.latitude,
        longitude: topPOI.longitude,
        distanceKm: dist,
        isExactMatch: true,
        category: 'exact_address',
        components: {
          houseNumber: userHousePrefix,
          street: topPOI.street,
          locality: topPOI.locality,
          colony: topPOI.locality,
          landmark: topPOI.name,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: topPOI.pincode,
          country: 'India',
        },
      });
      seenTitles.add(exactTitle.toLowerCase());
    }

    // Add matching POIs to suggestions
    for (const { poi } of matchingPOIs) {
      if (seenTitles.has(poi.name.toLowerCase())) continue;
      seenTitles.add(poi.name.toLowerCase());

      const dist = searchCenter
        ? calculateDistanceKm(searchCenter.lat, searchCenter.lng, poi.latitude, poi.longitude)
        : undefined;

      results.push({
        id: `poi-${poi.name.replace(/\s+/g, '-').toLowerCase()}`,
        title: poi.name,
        subtitle: `${poi.locality}, Indore, MP ${poi.pincode}`,
        fullAddress: `${poi.name}, ${poi.locality}, Indore, Madhya Pradesh, ${poi.pincode}, India`,
        shortAddress: `${poi.name}, Indore`,
        latitude: poi.latitude,
        longitude: poi.longitude,
        distanceKm: dist,
        isExactMatch: queryLower === poi.name.toLowerCase(),
        category: poi.category,
        components: {
          street: poi.street,
          locality: poi.locality,
          colony: poi.locality,
          landmark: poi.name,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: poi.pincode,
          country: 'India',
        },
      });
    }

    // 3. Upstream OpenStreetMap Nominatim Query (with location biasing if searchCenter is available)
    try {
      const searchTerms = [trimmed];
      if (userHousePrefix && queryRemainder && queryRemainder !== trimmed) {
        searchTerms.push(queryRemainder);
        if (!queryRemainder.toLowerCase().includes('indore')) {
          searchTerms.push(`${queryRemainder}, Indore`);
        }
      } else if (!trimmed.toLowerCase().includes('indore')) {
        searchTerms.push(`${trimmed}, Indore`);
      }

      for (const term of searchTerms) {
        let nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(term)}&addressdetails=1&limit=6&countrycodes=in`;

        // Apply location bias viewbox around searchCenter (approx ±0.15 deg ~ 15km)
        if (searchCenter) {
          const minLat = searchCenter.lat - 0.15;
          const maxLat = searchCenter.lat + 0.15;
          const minLon = searchCenter.lng - 0.15;
          const maxLon = searchCenter.lng + 0.15;
          nominatimUrl += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=0`;
        }

        const res = await rateLimitedFetch(nominatimUrl);
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              const lat = Number(parseFloat(item.lat).toFixed(6));
              const lng = Number(parseFloat(item.lon).toFixed(6));

              // Clean address using priority rules
              const parsed = this.cleanAddressComponents(item.address, userHousePrefix, item.name);
              const displayTitle = userHousePrefix
                ? `${userHousePrefix}, ${parsed.components.locality || parsed.components.street || item.name}`
                : item.name || parsed.shortAddress;

              if (seenTitles.has(displayTitle.toLowerCase())) continue;
              seenTitles.add(displayTitle.toLowerCase());

              const dist = searchCenter
                ? calculateDistanceKm(searchCenter.lat, searchCenter.lng, lat, lng)
                : undefined;

              results.push({
                id: `nom-${item.place_id || Date.now()}-${results.length}`,
                title: displayTitle,
                subtitle: parsed.formattedAddress,
                fullAddress: parsed.formattedAddress,
                shortAddress: parsed.shortAddress,
                latitude: lat,
                longitude: lng,
                distanceKm: dist,
                isExactMatch: false,
                category: item.type || item.category,
                components: parsed.components,
              });
            }
          }
        }

        // If we already have 4+ results, break to minimize upstream requests
        if (results.length >= 5) break;
      }
    } catch {
      // Graceful fallback: return local POI and synthesized matches
    }

    // 4. Sort results: Exact matches first, then direct locality matches, then by proximity to search center
    results.sort((a, b) => {
      if (a.isExactMatch && !b.isExactMatch) return -1;
      if (!a.isExactMatch && b.isExactMatch) return 1;

      // Proximity comparison if distances available
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });

    // Cap at 8 high-relevance suggestions
    const finalResults = results.slice(0, 8);
    searchCache.set(cacheKey, { data: finalResults, timestamp: Date.now() });
    return finalResults;
  }
}

