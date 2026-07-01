import { App, requestUrl, normalizePath } from "obsidian";
import { WeatherDisplayData } from "../dashboard/timeWeather";

export type WeatherOnlineProvider = "auto" | "open-meteo" | "wttr";

export interface WeatherRequestOptions {
  locationName: string;
  latitude: number;
  longitude: number;
  unit: "celsius" | "fahrenheit";
  provider?: WeatherOnlineProvider;
}

interface OpenMeteoCurrentResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}

interface WttrCurrentResponse {
  current_condition?: Array<{
    temp_C?: string;
    temp_F?: string;
    weatherCode?: string;
    windspeedKmph?: string;
    weatherDesc?: Array<{ value?: string }>;
    localObsDateTime?: string;
  }>;
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
    const providers = getProviderOrder(options.provider ?? "auto");
    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        const data = provider === "wttr"
          ? await fetchWttrWeather(options)
          : await fetchOpenMeteoWeather(options);
        await this.writeCachedWeather(date, data);
        return data;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Weather sync failed");
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

async function fetchOpenMeteoWeather(options: WeatherRequestOptions): Promise<WeatherDisplayData> {
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
    const networkTime = readNetworkDateHeader(response.headers);
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
      networkTime,
      provider: "Open-Meteo",
      observedAt: typeof current.time === "string" ? current.time : null,
      fetchedAt: formatLocalDateTime(new Date())
    };
    return data;
}

async function fetchWttrWeather(options: WeatherRequestOptions): Promise<WeatherDisplayData> {
  const url = `https://wttr.in/${encodeURIComponent(`${options.latitude},${options.longitude}`)}?format=j1`;
  const response = await requestUrlWithTimeout(url, 10000);
  const networkTime = readNetworkDateHeader(response.headers);
  const json = response.json as WttrCurrentResponse;
  const current = json.current_condition?.[0];
  const temperature = Number(options.unit === "fahrenheit" ? current?.temp_F : current?.temp_C);
  const weatherCode = Number(current?.weatherCode);
  if (!current || !Number.isFinite(temperature)) {
    throw new Error("wttr.in returned invalid current weather data");
  }
  const windSpeed = Number(current.windspeedKmph);
  return {
    locationName: options.locationName,
    temperature,
    unit: options.unit,
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : 3,
    conditionLabel: current.weatherDesc?.[0]?.value,
    windSpeed: Number.isFinite(windSpeed) ? windSpeed : null,
    networkTime,
    provider: "wttr.in",
    observedAt: current.localObsDateTime ?? null,
    fetchedAt: formatLocalDateTime(new Date())
  };
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

function getProviderOrder(provider: WeatherOnlineProvider): Array<Exclude<WeatherOnlineProvider, "auto">> {
  if (provider === "open-meteo") return ["open-meteo"];
  if (provider === "wttr") return ["wttr"];
  return ["open-meteo", "wttr"];
}

function readNetworkDateHeader(headers: Record<string, string> | undefined): string | null {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === "date" && value) return value;
  }
  return null;
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
