export type MapPosition = Readonly<{ latitude: number; longitude: number }>;

export function parseMapPosition(value: string): MapPosition | null {
  const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function locationFailure(code: number): string {
  if (code === 1) return "Location permission was declined. Allow location in your browser settings, or choose a city or enter coordinates.";
  if (code === 3) return "Location took too long. Try again outdoors, or choose a city or enter coordinates.";
  return "Your device could not determine its location. Try again, or choose a city or enter coordinates.";
}
