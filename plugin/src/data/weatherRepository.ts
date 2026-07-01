import { App, requestUrl, normalizePath } from "obsidian";
import { WeatherDisplayData } from "../dashboard/timeWeather";

export interface WeatherRequestOptions {
  locationName: string;
  latitude: number;
  longitude: number;
  unit: "celsius" | "fahrenheit";
}

interface OpenMeteoCurrentResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}

export class WeatherRepository {
  private app: App;
  private planningSystemPath: string;

  constructor(app: App, planningSystemPath: string) {
    this.app = app;
    this.planningSystemPath = planningSystemPath;
  }

  async readCachedWeather(date: string): Promise<WeatherDisplayData | null> {
    const path = this.getCachePath(date);
    if (!(await this.app.vault.adapter.exists(path))) return null;
    try {
      return JSON.parse(await this.app.vault.adapter.read(path)) as WeatherDisplayData;
    } catch {
      return null;
    }
  }

  async fetchAndCacheCurrentWeather(date: string, options: WeatherRequestOptions): Promise<WeatherDisplayData> {
    const temperatureUnit = options.unit === "fahrenheit" ? "fahrenheit" : "celsius";
    const url = [
      "https://api.open-meteo.com/v1/forecast",
      `?latitude=${encodeURIComponent(String(options.latitude))}`,
      `&longitude=${encodeURIComponent(String(options.longitude))}`,
      "&current=time,temperature_2m,weather_code,wind_speed_10m",
      `&temperature_unit=${temperatureUnit}`,
      "&wind_speed_unit=kmh",
      "&timezone=auto"
    ].join("");
    const response = await requestUrlWithTimeout(url, 10000);
    const json = response.json as OpenMeteoCurrentResponse;
    const current = json.current;
    if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") {
      throw new Error("Open-Meteo 返回缺少当前天气字段");
    }
    const data: WeatherDisplayData = {
      locationName: options.locationName,
      temperature: current.temperature_2m,
      unit: options.unit,
      weatherCode: current.weather_code,
      windSpeed: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
      networkTime: typeof current.time === "string" ? current.time : null,
      fetchedAt: formatLocalDateTime(new Date())
    };
    await this.writeCachedWeather(date, data);
    return data;
  }

  private async writeCachedWeather(date: string, data: WeatherDisplayData): Promise<void> {
    const folder = normalizePath(`${this.planningSystemPath}/WeatherCache`);
    await ensureFolder(this.app, folder);
    await this.app.vault.adapter.write(this.getCachePath(date), JSON.stringify(data, null, 2));
  }

  private getCachePath(date: string): string {
    return normalizePath(`${this.planningSystemPath}/WeatherCache/${date}_weather.json`);
  }
}

async function requestUrlWithTimeout(url: string, timeoutMs: number): Promise<Awaited<ReturnType<typeof requestUrl>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`联网同步超时（${Math.round(timeoutMs / 1000)}秒）`)), timeoutMs);
  });
  try {
    return await Promise.race([
      requestUrl({ url, method: "GET" }),
      timeout
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const parts = normalizePath(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.createFolder(current);
    }
  }
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
