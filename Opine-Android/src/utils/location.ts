import * as Location from 'expo-location';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  city: string;
  state: string;
  country: string;
  timestamp: string;
  source: 'gps' | 'wifi_triangulation' | 'network' | 'google_maps' | 'manual';
}

export class LocationService {
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  static async getCurrentLocation(skipOnlineGeocoding: boolean = false): Promise<LocationResult> {
    try {
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Try high accuracy GPS first
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const address = await this.reverseGeocode(location.coords.latitude, location.coords.longitude, skipOnlineGeocoding);

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          address: address.formatted,
          city: address.city,
          state: address.state,
          country: address.country,
          timestamp: new Date().toISOString(),
          source: 'gps',
        };
      } catch (gpsError) {
        console.warn('GPS location failed, trying network location:', gpsError);
        
        // Fallback to network location (WiFi triangulation)
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const address = await this.reverseGeocode(location.coords.latitude, location.coords.longitude, skipOnlineGeocoding);

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          address: address.formatted,
          city: address.city,
          state: address.state,
          country: address.country,
          timestamp: new Date().toISOString(),
          source: 'wifi_triangulation',
        };
      }
    } catch (error: any) {
      console.error('Location detection failed:', error);
      throw new Error(`Location detection failed: ${error.message}`);
    }
  }

  static async reverseGeocode(latitude: number, longitude: number, skipOnlineGeocoding: boolean = false) {
    try {
      // Use Expo's built-in reverse geocoding (works offline on device)
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        return {
          formatted: `${address.street || ''} ${address.streetNumber || ''}, ${address.city || ''}, ${address.region || ''}, ${address.country || ''}`.trim(),
          street: `${address.street || ''} ${address.streetNumber || ''}`.trim(),
          city: address.city || '',
          state: address.region || '',
          country: address.country || '',
          postalCode: address.postalCode || '',
        };
      } else {
        // If skipOnlineGeocoding is true (offline mode), return coordinates only
        if (skipOnlineGeocoding) {
          console.log('📴 Offline mode - skipping online geocoding, returning coordinates only');
          return {
            formatted: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            street: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
          };
        }
        // Fallback to free Nominatim API (only if online)
        return await this.reverseGeocodeNominatim(latitude, longitude);
      }
    } catch (error) {
      // If skipOnlineGeocoding is true (offline mode), return coordinates only
      if (skipOnlineGeocoding) {
        console.log('📴 Offline mode - Expo geocoding failed, returning coordinates only');
        return {
          formatted: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          street: '',
          city: '',
          state: '',
          country: '',
          postalCode: '',
        };
      }
      console.warn('Expo reverse geocoding failed, trying Nominatim:', error);
      return await this.reverseGeocodeNominatim(latitude, longitude);
    }
  }

  static async reverseGeocodeNominatim(latitude: number, longitude: number) {
    try {
      // Check if online before making network request
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const testResponse = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (testError) {
        // Not online, return coordinates only
        console.log('📴 Offline - skipping Nominatim reverse geocoding');
        return {
          formatted: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          street: '',
          city: '',
          state: '',
          country: '',
          postalCode: '',
        };
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        return {
          formatted: data.display_name,
          street: data.address?.road || data.address?.house_number || '',
          city: data.address?.city || data.address?.town || data.address?.village || '',
          state: data.address?.state || data.address?.county || '',
          country: data.address?.country || '',
          postalCode: data.address?.postcode || '',
        };
      } else {
        throw new Error('No address data received from Nominatim');
      }
    } catch (error) {
      console.error('Nominatim reverse geocoding failed:', error);
      // Return coordinates only on error (works offline)
      return {
        formatted: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      };
    }
  }

  static formatLocationForDisplay(location: LocationResult): string {
    if (location.address && location.address !== `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`) {
      return location.address;
    }
    
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }
}
