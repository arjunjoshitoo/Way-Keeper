import React, { useState, useCallback, useEffect } from 'react';

// HELPER ICONS

const MapPinIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline-block" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
);

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

// MAIN 

function haversine(a, b){
  const R = 6371;
  const toRad = deg => deg * Math.PI/180;
  const dlat = toRad(b.lat - a.lat);
  const dlng = toRad(b.lng - a.lng);
  lat1 = toRad(a.lat);
  lat2 = toRad(b.lat);

  aVal = Math.sin(dlat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function calculateTotalDistance(path, locations){
  let totalDistance = 0;
  for (let i =0; i < length.path - 1; i++){
    const from = locations[path[i]];
    const to = locations[path[i + 1]];
    totalDistance += haversine(from.coord, to.coord);
  }
  return totalDistance;
}

function nearestNeighbor(locations){
  const n = locations.length;
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i)); 
  const path = [];

  let currentIdx = 0;
  path.push(currentIdx);
  unvisited.delete(currentIdx);

  while (unvisited.size > 0){
    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (const idx of unvisited){
      const dist = haversine(locations[currentIdx].coord, locations[idx].coord);
      if (dist < nearestDist){
        nearestDist = dist;
        nearestIdx = idx;
      }

    }
    currentIdx = nearestIdx;
    path.push(currentIdx);
    unvisited.delete(currentIdx);
  }
  return path;
}

function apply2Opt(initialPath, locations){
  let bestPath = [...initialPath];
  let improved = true;

  while (improved){
    improved = false;
    for (let i = 1; i < bestPath.length - 2; i++){
      for (let j = i + 1; i < bestPath.length - 1; j++){
        const currentEdgeDist = haversine(locations[bestPath[i - 1]]. coord, locations[bestPath[i]].coord) +
                                haversine(locations[bestPath [j]].coord, locations[bestPath[j + 1].coord]);

        const newEdgeDist = haversine(locations[bestPath[i - 1]].coord, locations[bestPath[j]].coord) +
                            haversine(locations[bestPath[i]].coord, locations[bestPath[j + 1]]. coord);
        
        if (newEdgeDist < currentEdgeDist){
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
    const baseUrl = "https://www.google.com/maps/dir/";
    const waypoints = path.map(index => {
        const { lat, lng } = locations[index].coord;
        return `${lat},${lng}`;
    }).join('/');
    return baseUrl + waypoints;
}

// UI HELPER COMPONENTS

const StatCard = ({ label, value, subtext, colorClass }) => (
    <div className={`flex-1 p-4 bg-gray-50 rounded-lg text-center ${colorClass}`}>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
    </div>
);


export default function App(){

  const [locationsInput, setLocationsInput]  = useState("Amber Palace, Jaipur\nAlbert Hall Museum, Jaipur\nHawa Mahal\nCentral Park, Jaipur\nJal Mahal");
  const [optimizedUrl, setoptimizedUrl]      = useState("");
  const [stats, setStats]                    = useState(null);
  const [isloading, setIsLoading]            = useState(false);
  const [error, setError]                    = useState(null);
  const [iscopied, setIsCopied]              = useState(false);
  const [loadingmeassage, setLoadingMessage] = useState("");

  const handleOptimize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setoptimizedUrl("");
    setStats(null);
    setLoadingMessage("");

    //if no. of places is less than 2 then throw an error 
    const places = locationsInput.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (places.length < 2){
      setError("please enter at least 2 locations");
      setIsLoading(false);
      return;
    }
    try {

      // using a sequential loop for openstreetmap
      for (let i = 0; i < places.length; i++){
        const place = places[i];
        setLoadingMessage(`Geocoding ${i + 1}/${places.length}: ${place}...`);

        // 1 second delay between each request
        await new Promise(resolve => setTimeout(resolve, 1000));

        // API fetch 
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`);
        if (!response.ok){
          throw new Error(`Network response was not ok for ${place}`);
        }
        const data = await response.json();
      }
      const resolvedLocations = [];
      const failedPlaces = [];

      if (data && data.length > 0){
        resolvedLocations.push({
          name: place,
          coord:{
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon) // Nominatim uses 'lon'
          }

        });
      } else {
        failedPlaces.push(place);
      }
    }

    if (failedPlaces.length > 0){
      throw new Error(`Could not find coordinates for ${failedPlaces.join(',')}. Please check the spelling to be more specific`);
    }

    if (resolvedLocations < 2){
      setError("At least 2 places are needed for optimization");
      setIsLoading(false);
      return;
    }

    setLoadingMessage("Optimizing route.....");

    

  }


}