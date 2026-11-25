export const ACCESS_CLASSES = [
  { min: 0, label: '0–<20%', color: '#F1EEF6' },
  { min: 20, label: '20–<40%', color: '#BDC9E1' },
  { min: 40, label: '40–<60%', color: '#74A9CF' },
  { min: 60, label: '60–<80%', color: '#2B8CBE' },
  { min: 80, label: '80–100%', color: '#045A8D' },
];
export const MISSING_COLOR = '#B8BEC4';
const TOLERANCE = 1e-9;

// Normalization is for rendering only; exported analytical values stay unchanged.
export function displayPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -TOLERANCE || value > 100 + TOLERANCE) return null;
  return Math.max(0, Math.min(100, value));
}
export function accessibilityColor(value) {
  const percent = displayPercent(value);
  if (percent === null) return MISSING_COLOR;
  return ACCESS_CLASSES.findLast(item => percent >= item.min).color;
}
export function fillColorExpression() {
  return ['case', ['==', ['get', '_display_access_800'], null], MISSING_COLOR,
    ['step', ['get', '_display_access_800'], ACCESS_CLASSES[0].color,
      ...ACCESS_CLASSES.slice(1).flatMap(item => [item.min, item.color])]];
}

export function featureBounds(collection) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) throw new Error('Expected a non-empty GeoJSON FeatureCollection.');
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function visit(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length) throw new Error('Empty or invalid coordinates.');
    if (typeof coordinates[0] === 'number') {
      const [lng, lat] = coordinates;
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) throw new Error('Coordinates are not valid longitude/latitude.');
      bounds[0] = Math.min(bounds[0], lng); bounds[1] = Math.min(bounds[1], lat);
      bounds[2] = Math.max(bounds[2], lng); bounds[3] = Math.max(bounds[3], lat);
    } else coordinates.forEach(visit);
  }
  for (const feature of collection.features) {
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw new Error('Expected polygon geometry.');
    visit(feature.geometry.coordinates);
  }
  return [[bounds[0], bounds[1]], [bounds[2], bounds[3]]];
}

export function prepareDACollection(collection) {
  featureBounds(collection);
  const ids = new Set();
  return { ...collection, features: collection.features.map(feature => {
    const id = feature.properties?.DAUID;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('DAUID must be a unique non-empty string.');
    ids.add(id);
    return { ...feature, id, properties: { ...feature.properties, _display_access_800: displayPercent(feature.properties.Pct_Access_800) } };
  }) };
}

const numberFormat = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
export function formatPopulation(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -TOLERANCE) return 'Not available';
  return numberFormat.format(Math.max(0, value));
}
export function popupRows(properties, priorityIds) {
  const percent = displayPercent(properties.Pct_Access_800);
  return [
    ['DAUID', properties.DAUID ?? 'Not available'],
    ['Municipality', properties.FullName ?? 'Not available'],
    ['2021 Census population', formatPopulation(properties.Population)],
    ['Estimated population within 400 m', formatPopulation(properties.pop_access_400)],
    ['Estimated population within 800 m', formatPopulation(properties.pop_access_800)],
    ['Estimated population beyond 800 m', formatPopulation(properties.Pop_Beyond_800)],
    ['Estimated population within 800 m (%)', percent === null ? 'Not available' : `${percent.toFixed(1)}%`],
    ['Priority underserved', priorityIds ? (priorityIds.has(properties.DAUID) ? 'Yes' : 'No') : 'Not available — priority data not loaded'],
  ];
}
