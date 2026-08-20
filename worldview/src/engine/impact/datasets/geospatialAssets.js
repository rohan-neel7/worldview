/**
 * Static Geospatial Assets Reference Dataset
 *
 * Provides static reference infrastructure and population centers for
 * deterministic impact assessment and exposure analysis.
 *
 * Data Provenance:
 * - Cities & Population: UN World Urbanization Prospects & Natural Earth Populated Places (v5.1)
 * - Healthcare Facilities: Humanitarian OpenStreetMap / OpenStreetMap Healthcare (2024.1)
 * - Aviation Hubs: OurAirports / OpenFlights Database (2024.2)
 * - Maritime Ports: World Port Index (NGA Pub 150)
 * - Transport Corridors: OpenStreetMap Major Highway Network
 *
 * Data Mode: STATIC_REFERENCE (Explicitly labeled in UI)
 */

export const ASSET_PROVENANCE = {
  CITIES: { source: 'Natural Earth Populated Places / UN Urbanization', date: '2024-Q1', mode: 'STATIC_REFERENCE' },
  HOSPITALS: { source: 'OpenStreetMap Healthcare Registry', date: '2024-Q2', mode: 'STATIC_REFERENCE' },
  AIRPORTS: { source: 'OurAirports Global Aeronautical Database', date: '2024-Q2', mode: 'STATIC_REFERENCE' },
  PORTS: { source: 'World Port Index (NGA / OpenSeaMap)', date: '2024-Q1', mode: 'STATIC_REFERENCE' },
  ROADS: { source: 'OpenStreetMap Major Transit Corridors', date: '2024-Q1', mode: 'STATIC_REFERENCE' },
};

/**
 * Key Population Centers / Urban Clusters across major seismic zones
 */
export const GLOBAL_POPULATION_CENTERS = [
  // Southeast Asia & Pacific Rim (Indonesia, Philippines, Japan, PNG, Taiwan, NZ)
  { id: 'pop-ende', name: 'Ende, Flores', country: 'Indonesia', lat: -8.8432, lon: 121.6623, population: 87000, type: 'CITY' },
  { id: 'pop-maumere', name: 'Maumere', country: 'Indonesia', lat: -8.6199, lon: 122.2111, population: 85000, type: 'CITY' },
  { id: 'pop-kupang', name: 'Kupang', country: 'Indonesia', lat: -10.1772, lon: 123.6070, population: 442000, type: 'METRO' },
  { id: 'pop-denpasar', name: 'Denpasar, Bali', country: 'Indonesia', lat: -8.6705, lon: 115.2126, population: 960000, type: 'METRO' },
  { id: 'pop-mataram', name: 'Mataram, Lombok', country: 'Indonesia', lat: -8.5833, lon: 116.1167, population: 495000, type: 'METRO' },
  { id: 'pop-palu', name: 'Palu, Sulawesi', country: 'Indonesia', lat: -0.8917, lon: 119.8707, population: 372000, type: 'METRO' },
  { id: 'pop-padang', name: 'Padang, Sumatra', country: 'Indonesia', lat: -0.9492, lon: 100.3543, population: 928000, type: 'METRO' },
  { id: 'pop-banda-aceh', name: 'Banda Aceh', country: 'Indonesia', lat: 5.5483, lon: 95.3238, population: 252000, type: 'CITY' },
  { id: 'pop-davao', name: 'Davao City', country: 'Philippines', lat: 7.1907, lon: 125.4553, population: 1776000, type: 'METRO' },
  { id: 'pop-manila', name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842, population: 13480000, type: 'MEGA_METRO' },
  { id: 'pop-taipei', name: 'Taipei', country: 'Taiwan', lat: 25.0330, lon: 121.5654, population: 2600000, type: 'METRO' },
  { id: 'pop-hualien', name: 'Hualien City', country: 'Taiwan', lat: 23.9872, lon: 121.6016, population: 100000, type: 'CITY' },
  { id: 'pop-tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, population: 37400000, type: 'MEGA_METRO' },
  { id: 'pop-sendai', name: 'Sendai', country: 'Japan', lat: 38.2682, lon: 140.8694, population: 1090000, type: 'METRO' },
  { id: 'pop-auckland', name: 'Auckland', country: 'New Zealand', lat: -36.8485, lon: 174.7633, population: 1650000, type: 'METRO' },
  { id: 'pop-wellington', name: 'Wellington', country: 'New Zealand', lat: -41.2865, lon: 174.7762, population: 420000, type: 'METRO' },
  { id: 'pop-port-moresby', name: 'Port Moresby', country: 'Papua New Guinea', lat: -9.4438, lon: 147.1803, population: 380000, type: 'METRO' },
  { id: 'pop-rabaul', name: 'Rabaul', country: 'Papua New Guinea', lat: -4.1967, lon: 152.1764, population: 7000, type: 'SETTLEMENT' },

  // South Asia / Himalayas
  { id: 'pop-delhi', name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, population: 32900000, type: 'MEGA_METRO' },
  { id: 'pop-kathmandu', name: 'Kathmandu', country: 'Nepal', lat: 27.7172, lon: 85.3240, population: 1440000, type: 'METRO' },
  { id: 'pop-pokhara', name: 'Pokhara', country: 'Nepal', lat: 28.2096, lon: 83.9856, population: 518000, type: 'CITY' },
  { id: 'pop-islamabad', name: 'Islamabad', country: 'Pakistan', lat: 33.6844, lon: 73.0479, population: 1100000, type: 'METRO' },
  { id: 'pop-bengaluru', name: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946, population: 13190000, type: 'MEGA_METRO' },

  // Mediterranean / Middle East (Turkey, Greece, Iran, Italy)
  { id: 'pop-kahramanmaras', name: 'Kahramanmaras', country: 'Turkey', lat: 37.5858, lon: 36.9371, population: 1170000, type: 'METRO' },
  { id: 'pop-gaziantep', name: 'Gaziantep', country: 'Turkey', lat: 37.0662, lon: 37.3833, population: 2130000, type: 'METRO' },
  { id: 'pop-hatay', name: 'Antakya / Hatay', country: 'Turkey', lat: 36.2021, lon: 36.1606, population: 380000, type: 'CITY' },
  { id: 'pop-istanbul', name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784, population: 15800000, type: 'MEGA_METRO' },
  { id: 'pop-izmir', name: 'Izmir', country: 'Turkey', lat: 38.4237, lon: 27.1428, population: 4360000, type: 'METRO' },
  { id: 'pop-athens', name: 'Athens', country: 'Greece', lat: 37.9838, lon: 23.7275, population: 3150000, type: 'METRO' },
  { id: 'pop-naples', name: 'Naples', country: 'Italy', lat: 40.8518, lon: 14.2681, population: 2180000, type: 'METRO' },
  { id: 'pop-tehran', name: 'Tehran', country: 'Iran', lat: 35.6892, lon: 51.3890, population: 9400000, type: 'MEGA_METRO' },

  // Americas (West Coast, Chile, Peru, Mexico, Alaska)
  { id: 'pop-los-angeles', name: 'Los Angeles', country: 'USA', lat: 34.0522, lon: -118.2437, population: 3898000, type: 'MEGA_METRO' },
  { id: 'pop-san-francisco', name: 'San Francisco', country: 'USA', lat: 37.7749, lon: -122.4194, population: 873965, type: 'METRO' },
  { id: 'pop-seattle', name: 'Seattle', country: 'USA', lat: 47.6062, lon: -122.3321, population: 737015, type: 'METRO' },
  { id: 'pop-anchorage', name: 'Anchorage', country: 'USA', lat: 61.2181, lon: -149.9003, population: 291000, type: 'CITY' },
  { id: 'pop-mexico-city', name: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332, population: 21800000, type: 'MEGA_METRO' },
  { id: 'pop-oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lon: -96.7266, population: 300000, type: 'CITY' },
  { id: 'pop-santiago', name: 'Santiago', country: 'Chile', lat: -33.4489, lon: -70.6693, population: 6800000, type: 'MEGA_METRO' },
  { id: 'pop-valparaiso', name: 'Valparaíso', country: 'Chile', lat: -33.0472, lon: -71.6127, population: 315000, type: 'CITY' },
  { id: 'pop-lima', name: 'Lima', country: 'Peru', lat: -12.0464, lon: -77.0428, population: 10000000, type: 'MEGA_METRO' },
];

/**
 * Regional Healthcare Facilities / Hospitals
 */
export const GLOBAL_HOSPITALS = [
  // Indonesia & Southeast Asia
  { id: 'hosp-ende-01', name: 'RSUD Ende General Hospital', category: 'REGIONAL_HOSPITAL', lat: -8.8350, lon: 121.6550, beds: 240, traumaTier: 'LEVEL_2', status: 'OPERATIONAL' },
  { id: 'hosp-ende-02', name: 'RS St Antonius Jopu', category: 'COMMUNITY_CLINIC', lat: -8.7610, lon: 121.8230, beds: 65, traumaTier: 'LEVEL_3', status: 'OPERATIONAL' },
  { id: 'hosp-maumere-01', name: 'RSUD TC Hillers Maumere', category: 'REGIONAL_HOSPITAL', lat: -8.6255, lon: 122.2150, beds: 280, traumaTier: 'LEVEL_2', status: 'OPERATIONAL' },
  { id: 'hosp-kupang-01', name: 'RSUD Prof Dr WZ Johannes Kupang', category: 'TERTIARY_HOSPITAL', lat: -10.1650, lon: 123.5980, beds: 480, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-denpasar-01', name: 'RSUP Sanglah Denpasar', category: 'TERTIARY_HOSPITAL', lat: -8.6750, lon: 115.2150, beds: 750, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-mataram-01', name: 'RSUD Provinsi NTB Mataram', category: 'REGIONAL_HOSPITAL', lat: -8.5890, lon: 116.1250, beds: 350, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-palu-01', name: 'RSUD Undata Palu', category: 'TERTIARY_HOSPITAL', lat: -0.8750, lon: 119.8850, beds: 400, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-hualien-01', name: 'Hualien Tzu Chi Hospital', category: 'TERTIARY_HOSPITAL', lat: 23.9980, lon: 121.6020, beds: 900, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-sendai-01', name: 'Tohoku University Hospital', category: 'TERTIARY_HOSPITAL', lat: 38.2710, lon: 140.8580, beds: 1200, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },

  // South Asia / Himalayas
  { id: 'hosp-kathmandu-01', name: 'Tribhuvan University Teaching Hospital', category: 'TERTIARY_HOSPITAL', lat: 27.7360, lon: 85.3300, beds: 700, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-delhi-01', name: 'AIIMS New Delhi', category: 'TERTIARY_HOSPITAL', lat: 28.5672, lon: 77.2100, beds: 2400, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },

  // Mediterranean & Turkey
  { id: 'hosp-gaziantep-01', name: 'Gaziantep City Hospital', category: 'TERTIARY_HOSPITAL', lat: 37.0420, lon: 37.3650, beds: 1875, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-maras-01', name: 'Necip Fazil City Hospital', category: 'REGIONAL_HOSPITAL', lat: 37.5620, lon: 36.9150, beds: 600, traumaTier: 'LEVEL_2', status: 'OPERATIONAL' },
  { id: 'hosp-antakya-01', name: 'Hatay State Hospital', category: 'REGIONAL_HOSPITAL', lat: 36.2150, lon: 36.1750, beds: 450, traumaTier: 'LEVEL_2', status: 'OPERATIONAL' },

  // Americas
  { id: 'hosp-la-01', name: 'Cedars-Sinai Medical Center', category: 'TERTIARY_HOSPITAL', lat: 34.0754, lon: -118.3800, beds: 886, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-sf-01', name: 'Zuckerberg San Francisco General Hospital', category: 'TERTIARY_HOSPITAL', lat: 37.7554, lon: -122.4050, beds: 397, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-anchorage-01', name: 'Providence Alaska Medical Center', category: 'TERTIARY_HOSPITAL', lat: 61.1890, lon: -149.8180, beds: 401, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-santiago-01', name: 'Hospital Clínico Universidad de Chile', category: 'TERTIARY_HOSPITAL', lat: -33.4210, lon: -70.6550, beds: 520, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
  { id: 'hosp-lima-01', name: 'Hospital Nacional Edgardo Rebagliati Martins', category: 'TERTIARY_HOSPITAL', lat: -12.0780, lon: -77.0410, beds: 1400, traumaTier: 'LEVEL_1', status: 'OPERATIONAL' },
];

/**
 * Key Aviation Infrastructure / Runways
 */
export const GLOBAL_AIRPORTS = [
  { id: 'apt-ene', name: 'H. Hasan Aroeboesman Airport', icao: 'WATE', iata: 'ENE', lat: -8.8492, lon: 121.6644, runwayLengthM: 1650, capability: 'REGIONAL_TURBOPROP', status: 'OPERATIONAL' },
  { id: 'apt-mof', name: 'Frans Seda Airport', icao: 'WATC', iata: 'MOF', lat: -8.6406, lon: 122.2369, runwayLengthM: 2250, capability: 'COMMERCIAL_JET', status: 'OPERATIONAL' },
  { id: 'apt-koe', name: 'El Tari International Airport', icao: 'WATT', iata: 'KOE', lat: -10.1714, lon: 123.6706, runwayLengthM: 2500, capability: 'HEAVY_RELIEF_TRANSPORT', status: 'OPERATIONAL' },
  { id: 'apt-dps', name: 'I Gusti Ngurah Rai International Airport', icao: 'WADD', iata: 'DPS', lat: -8.7482, lon: 115.1672, runwayLengthM: 3000, capability: 'INTERNATIONAL_GATEWAY', status: 'OPERATIONAL' },
  { id: 'apt-lop', name: 'Lombok International Airport', icao: 'WADL', iata: 'LOP', lat: -8.7611, lon: 116.2764, runwayLengthM: 2750, capability: 'HEAVY_RELIEF_TRANSPORT', status: 'OPERATIONAL' },
  { id: 'apt-hun', name: 'Hualien Airport', icao: 'RCYU', iata: 'HUN', lat: 24.0233, lon: 121.6178, runwayLengthM: 2751, capability: 'DUAL_CIVIL_MILITARY', status: 'OPERATIONAL' },
  { id: 'apt-sdj', name: 'Sendai Airport', icao: 'RJSS', iata: 'SDJ', lat: 38.1397, lon: 140.9169, runwayLengthM: 3000, capability: 'INTERNATIONAL_GATEWAY', status: 'OPERATIONAL' },
  { id: 'apt-ktm', name: 'Tribhuvan International Airport', icao: 'VNKT', iata: 'KTM', lat: 27.6966, lon: 85.3591, runwayLengthM: 3350, capability: 'HIGH_ALTITUDE_HUB', status: 'OPERATIONAL' },
  { id: 'apt-gzt', name: 'Gaziantep Oguzeli Airport', icao: 'LTAJ', iata: 'GZT', lat: 36.9472, lon: 37.4786, runwayLengthM: 3000, capability: 'HEAVY_RELIEF_TRANSPORT', status: 'OPERATIONAL' },
  { id: 'apt-lax', name: 'Los Angeles International Airport', icao: 'KLAX', iata: 'LAX', lat: 33.9425, lon: -118.4081, runwayLengthM: 3939, capability: 'MAJOR_GLOBAL_HUB', status: 'OPERATIONAL' },
  { id: 'apt-sfo', name: 'San Francisco International Airport', icao: 'KSFO', iata: 'SFO', lat: 37.6190, lon: -122.3748, runwayLengthM: 3618, capability: 'MAJOR_GLOBAL_HUB', status: 'OPERATIONAL' },
  { id: 'apt-anc', name: 'Ted Stevens Anchorage International Airport', icao: 'PANC', iata: 'ANC', lat: 61.1744, lon: -149.9964, runwayLengthM: 3779, capability: 'GLOBAL_CARGO_CROSSROADS', status: 'OPERATIONAL' },
  { id: 'apt-scl', name: 'Arturo Merino Benítez International Airport', icao: 'SCEL', iata: 'SCL', lat: -33.3930, lon: -70.7858, runwayLengthM: 3800, capability: 'INTERNATIONAL_GATEWAY', status: 'OPERATIONAL' },
];

/**
 * Key Maritime Ports & Docks
 */
export const GLOBAL_PORTS = [
  { id: 'prt-ende', name: 'Port of Ende (Ipi)', unlocode: 'IDENE', lat: -8.8475, lon: 121.6580, depthM: 9.5, type: 'COASTAL_FERRY_CARGO', status: 'OPERATIONAL' },
  { id: 'prt-maumere', name: 'Port of Lauren Say Maumere', unlocode: 'IDMOF', lat: -8.6150, lon: 122.2180, depthM: 11.0, type: 'CONTAINER_BULK', status: 'OPERATIONAL' },
  { id: 'prt-tenau', name: 'Port of Tenau Kupang', unlocode: 'IDKOE', lat: -10.1980, lon: 123.5350, depthM: 14.0, type: 'DEEPWATER_REGIONAL_HUB', status: 'OPERATIONAL' },
  { id: 'prt-benoa', name: 'Port of Benoa Denpasar', unlocode: 'IDBOA', lat: -8.7450, lon: 115.2150, depthM: 12.0, type: 'CRUISE_CONTAINER', status: 'OPERATIONAL' },
  { id: 'prt-hualien', name: 'Port of Hualien', unlocode: 'TWHUN', lat: 23.9820, lon: 121.6320, depthM: 16.5, type: 'DEEPWATER_COMMERCIAL', status: 'OPERATIONAL' },
  { id: 'prt-sendai', name: 'Port of Sendai-Shiogama', unlocode: 'JPSDG', lat: 38.2750, lon: 141.0150, depthM: 15.0, type: 'INDUSTRIAL_CONTAINER', status: 'OPERATIONAL' },
  { id: 'prt-iskenderun', name: 'Port of Iskenderun', unlocode: 'TRISK', lat: 36.5950, lon: 36.1850, depthM: 14.5, type: 'MEDITERRANEAN_GATEWAY', status: 'OPERATIONAL' },
  { id: 'prt-long-beach', name: 'Port of Long Beach / LA', unlocode: 'USLGB', lat: 33.7540, lon: -118.2160, depthM: 20.0, type: 'MAJOR_PACIFIC_CONTAINER', status: 'OPERATIONAL' },
  { id: 'prt-valparaiso', name: 'Port of Valparaíso', unlocode: 'CLVAP', lat: -33.0360, lon: -71.6250, depthM: 16.0, type: 'NATIONAL_PACIFIC_PORT', status: 'OPERATIONAL' },
  { id: 'prt-callao', name: 'Port of Callao (Lima)', unlocode: 'PECLL', lat: -12.0520, lon: -77.1480, depthM: 16.0, type: 'PACIFIC_HUB', status: 'OPERATIONAL' },
];

/**
 * Major Transport Corridors / Arterial Highways
 */
export const GLOBAL_ROAD_CORRIDORS = [
  { id: 'cor-flores-trans', name: 'Trans-Flores Highway (National Route 1)', region: 'Flores Island, Indonesia', lat: -8.7500, lon: 121.9000, lengthKm: 664, criticalType: 'ISLAND_SPINE' },
  { id: 'cor-timor-trans', name: 'Trans-Timor Highway', region: 'East Nusa Tenggara, Indonesia', lat: -9.8500, lon: 124.2000, lengthKm: 285, criticalType: 'INTER_DISTRICT' },
  { id: 'cor-suhua-hwy', name: 'Suhua Highway (Provincial Highway 9)', region: 'Hualien-Yilan, Taiwan', lat: 24.1500, lon: 121.6500, lengthKm: 118, criticalType: 'COASTAL_CLIFF_PASS' },
  { id: 'cor-tohoku-exp', name: 'Tohoku Expressway (E4)', region: 'Tohoku Region, Japan', lat: 38.3000, lon: 140.7500, lengthKm: 679, criticalType: 'INTERSTATE_TRUNK' },
  { id: 'cor-prithvi-hwy', name: 'Prithvi Highway (H04)', region: 'Kathmandu-Pokhara, Nepal', lat: 27.9000, lon: 84.6000, lengthKm: 174, criticalType: 'MOUNTAIN_VALLEY_ARTERIAL' },
  { id: 'cor-tag-o52', name: 'TAG Motorway (O-52 / E90)', region: 'Gaziantep-Adana, Turkey', lat: 37.1000, lon: 37.0000, lengthKm: 365, criticalType: 'TRANSIT_CORRIDOR' },
  { id: 'cor-i5-ca', name: 'Interstate 5 Corridor', region: 'California, USA', lat: 34.5000, lon: -118.5000, lengthKm: 1280, criticalType: 'WEST_COAST_LIFELINE' },
  { id: 'cor-rt5-chile', name: 'Ruta 5 Pan-American Highway', region: 'Central Chile', lat: -33.2000, lon: -70.8000, lengthKm: 3360, criticalType: 'PAN_AMERICAN_TRUNK' },
];
