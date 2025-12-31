import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { loadGoogleMapsAPI } from '../utils/locationUtils';

const LocationMap = ({ locationData, height = '300px', showDetails = true }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!locationData?.coordinates) return;

    const initializeMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await loadGoogleMapsAPI();

        if (!mapRef.current) return;

        const { latitude, longitude } = locationData.coordinates;
        const center = { lat: latitude, lng: longitude };

        // Initialize map
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(mapInstance);

        // Create marker
        const markerInstance = new window.google.maps.Marker({
          position: center,
          map: mapInstance,
          title: 'Interview Location',
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
                <circle cx="16" cy="16" r="4" fill="#FFFFFF"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 16)
          }
        });

        setMarker(markerInstance);

        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1F2937;">Interview Location</h3>
              <p style="margin: 0; font-size: 12px; color: #6B7280;">
                ${locationData.address?.formatted || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #9CA3AF;">
                Accuracy: ${locationData.coordinates.accuracy ? `${Math.round(locationData.coordinates.accuracy)}m` : 'Unknown'}
              </p>
            </div>
          `
        });

        markerInstance.addListener('click', () => {
          infoWindow.open(mapInstance, markerInstance);
        });

        // Open info window by default
        infoWindow.open(mapInstance, markerInstance);

      } catch (error) {
        console.error('Error initializing map:', error);
        setError('Failed to load map');
      } finally {
        setIsLoading(false);
      }
    };

    initializeMap();
  }, [locationData]);

  if (!locationData?.coordinates) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height }}>
        <div className="text-center text-gray-500">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No location data available</p>
        </div>
      </div>
    );
  }

  const { latitude, longitude, accuracy } = locationData.coordinates;
  const { formatted, city, state, country } = locationData.address || {};

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#001D48] mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
            <div className="text-center p-4">
              <MapPin className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Location Details */}
      {showDetails && (
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
            <div className="p-2 bg-[#E6F0F8] rounded-lg">
              <Navigation className="w-5 h-5 text-[#373177]" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Interview Location</h4>
              <p className="text-sm text-[#001D48] mb-2">
                {formatted || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
              </p>
              <div className="flex items-center space-x-4 text-xs text-[#373177]">
                <span>Lat: {latitude.toFixed(6)}</span>
                <span>Lng: {longitude.toFixed(6)}</span>
                {accuracy && <span>Accuracy: {Math.round(accuracy)}m</span>}
                <span>Source: {locationData.source}</span>
              </div>
            </div>
          </div>

          {/* Address Breakdown */}
          {locationData.address && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {city && (
                <div className="flex justify-between">
                  <span className="text-gray-600">City:</span>
                  <span className="text-gray-900 font-medium">{city}</span>
                </div>
              )}
              {state && (
                <div className="flex justify-between">
                  <span className="text-gray-600">State:</span>
                  <span className="text-gray-900 font-medium">{state}</span>
                </div>
              )}
              {country && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Country:</span>
                  <span className="text-gray-900 font-medium">{country}</span>
                </div>
              )}
              {locationData.timestamp && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Captured:</span>
                  <span className="text-gray-900 font-medium">
                    {new Date(locationData.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* External Links */}
          <div className="flex space-x-2">
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Google Maps</span>
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in OpenStreetMap</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationMap;
