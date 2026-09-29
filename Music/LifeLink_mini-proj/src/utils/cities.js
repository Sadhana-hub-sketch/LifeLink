import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const citiesFilePath = path.join(__dirname, "../../public/data/cities.json");

let citiesList = [];
let citiesMap = new Map();

try {
  const data = fs.readFileSync(citiesFilePath, "utf8");
  citiesList = JSON.parse(data);
  for (const city of citiesList) {
    citiesMap.set(city.name.toLowerCase(), city);
  }
} catch (err) {
  console.error("Failed to load cities.json:", err.message);
}

export function getAllCities() {
  return citiesList;
}

export function isValidCity(cityName) {
  if (!cityName) return false;
  return citiesMap.has(cityName.trim().toLowerCase());
}

export function getCityByName(cityName) {
  if (!cityName) return null;
  return citiesMap.get(cityName.trim().toLowerCase()) || null;
}
