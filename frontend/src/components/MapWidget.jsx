import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';

// Import CSS inside JS to ensure Leaflet styles are applied (or via index.css import)
// We already included Leaflet styles in index.css

// Helper to auto-recenter map when coords update
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

// Generate custom SVG markers to prevent bundler asset path breakages and allow colors
const createMarkerIcon = (color) => {
  return L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `,
    className: 'custom-leaflet-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

export default function MapWidget({ ip, geolocation, provider }) {
  if (!geolocation) return null;

  const { ipinfo, ip_api, confidence } = geolocation;
  const status = confidence?.status;

  const hasIpinfoCoords = ipinfo && typeof ipinfo.lat === 'number' && typeof ipinfo.lon === 'number' && (ipinfo.lat !== 0 || ipinfo.lon !== 0);
  const hasIpApiCoords = ip_api && typeof ip_api.lat === 'number' && typeof ip_api.lon === 'number' && (ip_api.lat !== 0 || ip_api.lon !== 0);

  // If both missing or coordinates are (0,0)
  if (!hasIpinfoCoords && !hasIpApiCoords) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500 min-h-[300px]">
        <MapPinOff className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm font-semibold">Map unavailable — no coordinates returned</p>
        <p className="text-xs text-slate-400 mt-1">Both geolocation providers failed to return valid coordinates.</p>
      </div>
    );
  }

  // Determine markers to render
  const markers = [];
  let center = [0, 0];

  if (status === 'confirmed' && hasIpinfoCoords) {
    // Sources agree -> Green marker
    center = [ipinfo.lat, ipinfo.lon];
    markers.push({
      coords: [ipinfo.lat, ipinfo.lon],
      color: '#10b981', // green-500
      sourceName: 'Both Sources (Confirmed)',
      city: ipinfo.city,
      country: ipinfo.country,
      isp: ipinfo.isp
    });
  } else if (status === 'disagreed') {
    // Sources disagree -> Two pins
    if (hasIpinfoCoords && hasIpApiCoords) {
      center = [ipinfo.lat, ipinfo.lon]; // Default center to ipinfo
      markers.push({
        coords: [ipinfo.lat, ipinfo.lon],
        color: '#2563eb', // blue-600 (Primary: ipinfo)
        sourceName: 'ipinfo.io',
        city: ipinfo.city,
        country: ipinfo.country,
        isp: ipinfo.isp
      });
      markers.push({
        coords: [ip_api.lat, ip_api.lon],
        color: '#ea580c', // orange-600 (Secondary: ip-api)
        sourceName: 'ip-api.com',
        city: ip_api.city,
        country: ip_api.country,
        isp: ip_api.isp
      });
    } else {
      // If one of them didn't have coordinates even in disagreement
      const activeGeo = hasIpinfoCoords ? ipinfo : ip_api;
      const srcName = hasIpinfoCoords ? 'ipinfo.io' : 'ip-api.com';
      center = [activeGeo.lat, activeGeo.lon];
      markers.push({
        coords: [activeGeo.lat, activeGeo.lon],
        color: '#d97706', // amber-600
        sourceName: srcName,
        city: activeGeo.city,
        country: activeGeo.country,
        isp: activeGeo.isp
      });
    }
  } else if (status === 'single') {
    // Single source -> Grey/Slate marker
    const activeGeo = hasIpinfoCoords ? ipinfo : ip_api;
    const srcName = hasIpinfoCoords ? 'ipinfo.io' : 'ip-api.com';
    center = [activeGeo.lat, activeGeo.lon];
    markers.push({
      coords: [activeGeo.lat, activeGeo.lon],
      color: '#64748b', // slate-500
      sourceName: srcName,
      city: activeGeo.city,
      country: activeGeo.country,
      isp: activeGeo.isp
    });
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm h-[350px] relative bg-slate-50">
      <MapContainer
        center={center}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <ChangeView center={center} zoom={10} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((marker, idx) => (
          <Marker
            key={idx}
            position={marker.coords}
            icon={createMarkerIcon(marker.color)}
          >
            <Popup>
              <div className="text-xs p-1 select-text">
                {provider ? (
                  <p className="font-semibold text-slate-800">{provider} Mail Server — not sender location</p>
                ) : (
                  <>
                    <p className="font-bold border-b border-slate-200 pb-1 mb-1.5 text-slate-800 flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: marker.color }}></span>
                      {marker.sourceName}
                    </p>
                    <div className="space-y-1">
                      <p><b>IP:</b> <span className="font-mono">{ip}</span></p>
                      <p><b>City:</b> {marker.city || 'N/A'}</p>
                      <p><b>Country:</b> {marker.country || 'N/A'}</p>
                      <p><b>ISP:</b> <span className="text-[10px] leading-tight block">{marker.isp || 'N/A'}</span></p>
                    </div>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
