/**
 * Worldview Supported Crisis Theaters & Country Definitions
 * Contains precise geographic bounds, center coordinates, recommended viewing altitudes,
 * and key regional tectonic/climatic vulnerability vectors.
 */

export const COUNTRIES = [
  {
    id: 'IN',
    name: 'India',
    code: 'IND',
    region: 'South Asia',
    center: { lat: 20.5937, lon: 78.9629 },
    defaultAlt: 4800000,
    bounds: {
      minLat: 6.5,
      maxLat: 37.5,
      minLon: 68.0,
      maxLon: 97.5,
    },
    flag: '🇮🇳',
    riskProfile: 'High Seismic & Monsoon Flood Vulnerability',
    primaryHazards: ['FLOOD', 'EARTHQUAKE', 'CYCLONE'],
    theaters: [
      { name: 'Himalayan Frontal Thrust', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Bengaluru Urban Catchment', type: 'FLOOD', risk: 'CRITICAL' },
      { name: 'Bay of Bengal Coastal Zone', type: 'CYCLONE', risk: 'ELEVATED' },
      { name: 'Gujarat Rann / Kachchh Basin', type: 'SEISMIC', risk: 'MODERATE' },
    ],
  },
  {
    id: 'ID',
    name: 'Indonesia',
    code: 'IDN',
    region: 'Southeast Asia',
    center: { lat: -0.7893, lon: 113.9213 },
    defaultAlt: 5200000,
    bounds: {
      minLat: -11.0,
      maxLat: 6.0,
      minLon: 95.0,
      maxLon: 141.0,
    },
    flag: '🇮🇩',
    riskProfile: 'Pacific Ring of Fire & Tsunami Inundation Risk',
    primaryHazards: ['EARTHQUAKE', 'TSUNAMI', 'VOLCANO'],
    theaters: [
      { name: 'Flores Back-Arc Thrust', type: 'SEISMIC', risk: 'CRITICAL' },
      { name: 'Sunda Megathrust Corridor', type: 'TSUNAMI', risk: 'HIGH' },
      { name: 'Molucca Sea Collision Complex', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Java Volcanic Arc', type: 'VOLCANIC', risk: 'ELEVATED' },
    ],
  },
  {
    id: 'JP',
    name: 'Japan',
    code: 'JPN',
    region: 'East Asia',
    center: { lat: 36.2048, lon: 138.2529 },
    defaultAlt: 3500000,
    bounds: {
      minLat: 24.0,
      maxLat: 46.0,
      minLon: 122.0,
      maxLon: 150.0,
    },
    flag: '🇯🇵',
    riskProfile: 'Deep Subduction Megathrust & Multi-Hazard Resilience',
    primaryHazards: ['EARTHQUAKE', 'TSUNAMI', 'TYPHOON'],
    theaters: [
      { name: 'Nankai Trough Megathrust', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Japan Trench / Tohoku Sector', type: 'TSUNAMI', risk: 'HIGH' },
      { name: 'Sagami Trough / Tokyo Basin', type: 'INFRASTRUCTURE', risk: 'ELEVATED' },
      { name: 'Izu-Bonin Volcanic Chain', type: 'VOLCANIC', risk: 'MODERATE' },
    ],
  },
  {
    id: 'US',
    name: 'United States',
    code: 'USA',
    region: 'North America',
    center: { lat: 37.0902, lon: -95.7129 },
    defaultAlt: 6500000,
    bounds: {
      minLat: 24.5,
      maxLat: 49.5,
      minLon: -125.0,
      maxLon: -66.5,
    },
    flag: '🇺🇸',
    riskProfile: 'Transform Fault Systems & Continental Storm Basins',
    primaryHazards: ['EARTHQUAKE', 'WILDFIRE', 'HURRICANE'],
    theaters: [
      { name: 'Cascadia Subduction Zone', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'San Andreas Fault Complex', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Gulf Coast Basin', type: 'HURRICANE', risk: 'ELEVATED' },
      { name: 'Sierra Nevada Wildfire Corridor', type: 'WILDFIRE', risk: 'MODERATE' },
    ],
  },
  {
    id: 'TR',
    name: 'Turkey',
    code: 'TUR',
    region: 'Middle East / Europe',
    center: { lat: 38.9637, lon: 35.2433 },
    defaultAlt: 2800000,
    bounds: {
      minLat: 35.8,
      maxLat: 42.2,
      minLon: 25.6,
      maxLon: 44.8,
    },
    flag: '🇹🇷',
    riskProfile: 'Continental Strike-Slip Shear Zones',
    primaryHazards: ['EARTHQUAKE', 'LANDSLIDE'],
    theaters: [
      { name: 'East Anatolian Fault Zone', type: 'SEISMIC', risk: 'CRITICAL' },
      { name: 'North Anatolian Fault Zone', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Aegean Graben System', type: 'SEISMIC', risk: 'MODERATE' },
    ],
  },
  {
    id: 'PH',
    name: 'Philippines',
    code: 'PHL',
    region: 'Southeast Asia',
    center: { lat: 12.8797, lon: 121.7740 },
    defaultAlt: 3200000,
    bounds: {
      minLat: 4.5,
      maxLat: 21.5,
      minLon: 116.0,
      maxLon: 127.0,
    },
    flag: '🇵🇭',
    riskProfile: 'Archipelagic Subduction & Tropical Cyclone Belt',
    primaryHazards: ['TYPHOON', 'EARTHQUAKE', 'VOLCANO'],
    theaters: [
      { name: 'Philippine Trench', type: 'SEISMIC', risk: 'HIGH' },
      { name: 'Manila Trench Subduction', type: 'TSUNAMI', risk: 'HIGH' },
      { name: 'Eastern Seaboard Typhoon Track', type: 'STORM', risk: 'CRITICAL' },
    ],
  },
];

export function getCountryById(countryId) {
  if (!countryId) return COUNTRIES[0];
  const upper = countryId.toUpperCase();
  return (
    COUNTRIES.find((c) => c.id === upper || c.code === upper || c.name.toUpperCase() === upper) ||
    COUNTRIES[0]
  );
}

export function isPointInCountryBounds(lat, lon, country) {
  if (!country || !country.bounds) return true;
  const { minLat, maxLat, minLon, maxLon } = country.bounds;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}
