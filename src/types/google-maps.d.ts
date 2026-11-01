// Ambient declaration for the Google Maps JS API loaded at runtime.
// The @types/google.maps package is listed in package.json but not resolved
// by the installed node_modules; this minimal stub satisfies the TypeScript
// compiler for all google.maps.* references used in SiteLocationMap.tsx.

/* eslint-disable */
declare namespace google {
  namespace maps {
    interface MapMouseEvent {
      latLng: LatLng;
    }
    class Map {
      constructor(el: HTMLElement, opts?: any);
      setCenter(latlng: any): void;
      setZoom(zoom: number): void;
      panTo(latlng: any): void;
      fitBounds(bounds: any): void;
      getCenter(): any;
      getZoom(): number;
      addListener(event: string, fn: (...args: any[]) => void): any;
    }
    enum Animation {
      DROP = 2,
      BOUNCE = 1,
    }
    class Marker {
      constructor(opts?: any);
      setPosition(latlng: any): void;
      setMap(map: Map | null): void;
      getPosition(): LatLng;
      setVisible(visible: boolean): void;
      setDraggable(draggable: boolean): void;
      addListener(event: string, fn: (...args: any[]) => void): any;
    }
    class Geocoder {
      constructor();
      geocode(request: any, callback: (results: any, status: any) => void): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    class LatLngBounds {
      constructor();
      extend(latlng: any): void;
    }
    enum GeocoderStatus {
      OK = 'OK',
    }
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: any);
        getPlace(): any;
        addListener(event: string, fn: (...args: any[]) => void): any;
      }
    }
    namespace event {
      function clearInstanceListeners(instance: any): void;
    }
  }
}
