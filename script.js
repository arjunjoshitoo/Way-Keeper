// Utilities
function haversine(a, b) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dlat = toRad(b.lat - a.lat);
  const dlng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aVal = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function calculateTotalDistance(path, locations) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += haversine(locations[path[i]].coord, locations[path[i + 1]].coord);
  }
  return total;
}

function nearestNeighbor(locations) {
  const n = locations.length;
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i));
  const path = [0];
  unvisited.delete(0);
  let current = 0;

  while (unvisited.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let idx of unvisited) {
      const dist = haversine(locations[current].coord, locations[idx].coord);
      if (dist < nearestDist) {
        nearest = idx;
        nearestDist = dist;
      }
    }
    path.push(nearest);
    unvisited.delete(nearest);
    current = nearest;
  }
  return path;
}

function apply2Opt(initialPath, locations) {
  let bestPath = [...initialPath];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < bestPath.length - 2; i++) {
      for (let j = i + 1; j < bestPath.length - 1; j++) {
        const currentDist = haversine(locations[bestPath[i - 1]].coord, locations[bestPath[i]].coord) +
          haversine(locations[bestPath[j]].coord, locations[bestPath[j + 1]].coord);
        const newDist = haversine(locations[bestPath[i - 1]].coord, locations[bestPath[j]].coord) +
          haversine(locations[bestPath[i]].coord, locations[bestPath[j + 1]].coord);
        if (newDist < currentDist) {
          const newPath = [...bestPath.slice(0, i), ...bestPath.slice(i, j + 1).reverse(), ...bestPath.slice(j + 1)];
          bestPath = newPath;
          improved = true;
        }
      }
    }
  }
  return bestPath;
}

function generateMapsUrl(path, locations) {
  return "https://www.google.com/maps/dir/" + path.map(i => `${locations[i].coord.lat},${locations[i].coord.lng}`).join("/");
}

// DOM Elements
const locationsInput = document.getElementById("locations");
const optimizeBtn = document.getElementById("optimizeBtn");
const loadingMsg = document.getElementById("loadingMessage");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const resultBox = document.getElementById("resultBox");
const originalDist = document.getElementById("originalDist");
const optimizedDist = document.getElementById("optimizedDist");
const savedDist = document.getElementById("savedDist");
const savedPercent = document.getElementById("savedPercent");
const routeUrl = document.getElementById("routeUrl");
const copyBtn = document.getElementById("copyBtn");
const yearSpan = document.getElementById("year");

// Footer Year
yearSpan.textContent = new Date().getFullYear();

// Optimize Route
optimizeBtn.addEventListener("click", async () => {
  const places = locationsInput.value.split("\n").map(p => p.trim()).filter(p => p);
  if (places.length < 2) {
    showError("Please enter at least 2 locations");
    return;
  }

  clearUI();
  loadingMsg.textContent = "Geocoding locations...";

  try {
    const resolved = [];
    for (let i = 0; i < places.length; i++) {
      loadingMsg.textContent = `Geocoding ${i + 1}/${places.length}: ${places[i]}`;
      await new Promise(res => setTimeout(res, 800));
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(places[i])}&format=json&limit=1`);
      const data = await res.json();
      if (!data || !data.length) throw new Error(`Couldn't find: ${places[i]}`);
      resolved.push({ name: places[i], coord: { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } });
    }

    const originalPath = Array.from({ length: resolved.length }, (_, i) => i);
    const tspPath = nearestNeighbor(resolved);
    const optimizedPath = apply2Opt(tspPath, resolved);

    const origDist = calculateTotalDistance(originalPath, resolved);
    const optDist = calculateTotalDistance(optimizedPath, resolved);
    const saved = origDist - optDist;
    const percent = origDist > 0 ? ((saved / origDist) * 100).toFixed(1) : "0.0";
    const url = generateMapsUrl(optimizedPath, resolved);

    originalDist.textContent = `${origDist.toFixed(0)} km`;
    optimizedDist.textContent = `${optDist.toFixed(0)} km`;
    savedDist.textContent = `${saved.toFixed(0)} km`;
    savedPercent.textContent = `${percent}% shorter`;
    routeUrl.href = url;
    routeUrl.textContent = url;
    resultBox.classList.remove("hidden");
  } catch (e) {
    showError(e.message);
  } finally {
    loadingMsg.textContent = "";
  }
});

function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearUI() {
  errorBox.classList.add("hidden");
  resultBox.classList.add("hidden");
  errorText.textContent = "";
  routeUrl.textContent = "";
}

// Copy URL
copyBtn.addEventListener("click", () => {
  const url = routeUrl.href;
  if (!url) return;
  navigator.clipboard.writeText(url);
  const icon = document.getElementById("copyIcon");
  const original = icon.innerHTML;
  icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />';
  setTimeout(() => {
    icon.innerHTML = original;
  }, 2000);
});
