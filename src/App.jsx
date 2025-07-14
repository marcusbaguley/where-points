import React, { useState } from "react";
import { parseGPX } from "./utils/gpxParser";
import { parseCSV } from "./utils/csvParser";
import { snapToTrack } from "./utils/snapToTrack";
import { buildTCX } from "./utils/tcxBuilder";
import Button from "./components/Button";
import Card from "./components/Card";

export default function App() {
  const [baseGpx, setBaseGpx] = useState(null);
  const [poiGpx, setPoiGpx] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [tcx, setTcx] = useState("");
  const [error, setError] = useState("");

  // Parse and process
  const handleProcess = async () => {
    setError("");
    if (!baseGpx) {
      setError("Base GPX is required.");
      return;
    }
    try {
      // Parse GPX files
      const base = parseGPX(await baseGpx.text());
      const poi = poiGpx ? parseGPX(await poiGpx.text()) : { waypoints: [] };

      // Merge waypoints: base waypoints, base cues (routepoints), POI waypoints
      const allWaypoints = [
        ...(base.waypoints || []),
        ...(base.rtepts || []),
        ...(poi.waypoints || [])
      ];

      console.log(`[App] Merging: ${allWaypoints.length} waypoints/cues, ${base.trkpts.length} track points`);

      // Snap waypoints and cues to nearest track point
      const snapped = allWaypoints.map(pt => {
        const snappedPt = snapToTrack(pt, base.trkpts);
        return { ...snappedPt, name: pt.name, type: pt.type, notes: pt.name };
      });

      // Parse CSV and create cues
      const cues = parseCSV(csvText).map(row => {
        // Find by closest track point index using distance in KM
        const idx = Math.round((row.distance / trackLengthKm(base.trkpts)) * (base.trkpts.length - 1));
        const pt = base.trkpts[idx];
        return {
          ...pt,
          name: row.name,
          type: guessCueType(row.name),
          notes: `${row.name} (${row.distance} km)`
        };
      });

      console.log(`[App] Snapped ${snapped.length} waypoints/cues, ${cues.length} CSV cues`);

      const allCues = [...snapped, ...cues];

      // Build TCX
      setTcx(buildTCX(base.trkpts, allCues));
      console.log("[App] TCX generation complete");
    } catch (err) {
      setError("Failed to process: " + err.message);
      console.error("[App] Error in processing:", err);
    }
  };

  // For CSV cues: guess type by name
  function guessCueType(name) {
    if (/right/i.test(name)) return "Right";
    if (/left/i.test(name)) return "Left";
    if (/food|resupply/i.test(name)) return "Food";
    if (/hotel/i.test(name)) return "Hotel";
    return "Generic";
  }

  // Approximate total track length in KM for cue snapping
  function trackLengthKm(track) {
    let sum = 0;
    for (let i = 1; i < track.length; i++) {
      sum +=
        window.haversine(
          track[i - 1].lat,
          track[i - 1].lon,
          track[i].lat,
          track[i].lon
        ) / 1000;
    }
    return sum;
  }
  // Haversine function for length calc (browser global)
  window.haversine =
    window.haversine ||
    function (lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const toRad = v => (v * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center">where-points</h1>
        <Card title="1. Upload Base GPX">
          <input
            type="file"
            accept=".gpx"
            onChange={e => setBaseGpx(e.target.files[0])}
          />
        </Card>
        <Card title="2. Optional: Upload POI GPX">
          <input
            type="file"
            accept=".gpx"
            onChange={e => setPoiGpx(e.target.files[0])}
          />
        </Card>
        <Card title="3. Paste CSV Cues">
          <textarea
            rows={5}
            className="w-full border rounded p-2"
            placeholder="Name,Distance (km)\nResupply,25.4\nHotel,97.1"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
        </Card>
        {error && (
          <div className="bg-red-100 text-red-700 p-2 mb-2 rounded">{error}</div>
        )}
        <div className="flex justify-center">
          <Button onClick={handleProcess}>Merge & Generate TCX</Button>
        </div>
        {tcx && (
          <Card title="Download">
            <a
              href={`data:application/xml,${encodeURIComponent(tcx)}`}
              download="where-points.tcx"
            >
              <Button>Download TCX</Button>
            </a>
          </Card>
        )}
        <Card title="Info">
          <p>
            Upload your base GPX (with track and cues), optional waypoints GPX,
            and paste your CSV cues. All cues and waypoints will be snapped to the
            track and exported as a Garmin-compatible TCX.
          </p>
        </Card>
      </div>
    </div>
  );
}
