export interface WeatherDisplayData {
  locationName: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  weatherCode: number;
  windSpeed: number | null;
  networkTime: string | null;
  fetchedAt: string;
}

export function formatCurrentTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatCurrentDate(date: Date): string {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${weekdays[date.getDay()]}`;
}

export function parseNetworkWeatherTime(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWeatherSummary(data: WeatherDisplayData): string {
  const unit = data.unit === "fahrenheit" ? "°F" : "°C";
  const wind = data.windSpeed === null ? "" : `，风速 ${Math.round(data.windSpeed)}km/h`;
  return `${data.locationName} ${Math.round(data.temperature)}${unit}，${weatherCodeLabel(data.weatherCode)}${wind}`;
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return "晴";
  if ([1, 2, 3].includes(code)) return "多云";
  if ([45, 48].includes(code)) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气";
}
