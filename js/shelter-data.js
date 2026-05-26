/**
 * shelter-data.js
 *
 * Static seed data for SF bus shelter proposals.
 * In production this is supplemented by live data from Google Sheets.
 *
 * Each stop uses real SFMTA/511.org stop_id values and coordinates.
 * Design variants reference SFMTA's 2024 shelter design program.
 *
 * Schema:
 *   id          – unique internal ID (string)
 *   stop_id     – SFMTA stop_id from GTFS feed
 *   name        – human-readable stop name
 *   lat/lng     – WGS-84 decimal degrees
 *   routes      – array of Muni route tags serving the stop
 *   design      – "standard" | "solar" | "ada-enhanced" | "green-roof"
 *   description – plain-language proposal summary
 *   priority    – advocacy priority 1 (high) – 3 (low)
 *   imageUrl    – optional photo / render for the panel
 */
window.SHELTER_DATA = [
  {
    id: "shelter-001",
    stop_id: "15552",
    name: "Mission St & 16th St",
    lat: 37.76454,
    lng: -122.41964,
    routes: ["14", "14R", "49"],
    design: "solar",
    description: "High-ridership corner with no existing shelter. Solar-powered design with real-time arrival display and USB charging. Serves 16th St BART interchange — critical connectivity point.",
    priority: 1,
    imageUrl: null
  },
  {
    id: "shelter-002",
    stop_id: "15734",
    name: "Valencia St & 24th St",
    lat: 37.75223,
    lng: -122.42071,
    routes: ["14", "49", "67"],
    design: "green-roof",
    description: "Dense residential node. Proposed green-roof shelter with climbing plants, integrated seating, and bike parking. Addresses heat island + pedestrian comfort.",
    priority: 2,
    imageUrl: null
  },
  {
    id: "shelter-003",
    stop_id: "14008",
    name: "Market St & Castro St",
    lat: 37.76204,
    lng: -122.43497,
    routes: ["F", "24", "37"],
    design: "ada-enhanced",
    description: "ADA-enhanced shelter with widened boarding zone, tactile paving, and audio announcements. Current stop lacks any weather protection.",
    priority: 1,
    imageUrl: null
  },
  {
    id: "shelter-004",
    stop_id: "13228",
    name: "Geary Blvd & Divisadero St",
    lat: 37.78381,
    lng: -122.43803,
    routes: ["38", "38R", "24"],
    design: "standard",
    description: "High-frequency BRT corridor. Standard-plus shelter with extended roof, improved lighting, and digital arrival board. Part of Geary BRT upgrade proposal.",
    priority: 1,
    imageUrl: null
  },
  {
    id: "shelter-005",
    stop_id: "16995",
    name: "Taraval St & 19th Ave",
    lat: 37.74449,
    lng: -122.47624,
    routes: ["L", "28"],
    design: "solar",
    description: "Outer Sunset underserved stop. Solar shelter would provide first weather protection on this exposed ocean-side corridor.",
    priority: 2,
    imageUrl: null
  }
];

/**
 * Design labels and AR color coding
 */
window.DESIGN_META = {
  "solar":        { label: "Solar-Powered",    color: "#ffd60a", emoji: "☀️" },
  "standard":     { label: "Standard-Plus",    color: "#30d158", emoji: "🏗" },
  "ada-enhanced": { label: "ADA Enhanced",     color: "#64d2ff", emoji: "♿" },
  "green-roof":   { label: "Green Roof",       color: "#32d74b", emoji: "🌿" }
};

/**
 * Return shelters within `radiusMeters` of (lat, lng)
 */
window.getSheltersNearby = function(lat, lng, radiusMeters = 300) {
  return window.SHELTER_DATA.filter(s => {
    const dist = haversineMeters(lat, lng, s.lat, s.lng);
    s._distanceMeters = Math.round(dist);
    return dist <= radiusMeters;
  }).sort((a, b) => a._distanceMeters - b._distanceMeters);
};

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
