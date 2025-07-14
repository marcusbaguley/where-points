import React, { useState } from "react";
import { parseGPX } from "./utils/gpxParser";
import { parseCSV } from "./utils/csvParser";
import { interpolateTrackpoint } from "./utils/interpolateTrackpoint";
import { buildTCX } from "./utils/tcxBuilder";
import Button from "./components/Button";
import Card from "./components/Card";

export default function App() {
  const [baseGpx, setBaseGpx] = useState(null);
  const [poiGpx, setPoiGpx] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [tcx, setTcx] = useState("");
  const [error, setError] = useState("");

  // Insert a new trackpoint in the right place by distance
  function insertTrackpoint(track, newPt) {
    let idx = track.findIndex(pt => pt.distance > newPt.distance);
    if (idx === -1) idx = track.length;
    // Only insert if not already present (within 1e-6 meters and lat/lon)
    if (!track.some(pt =>
      Math.abs(pt.lat - newPt.lat) < 1e-9 &&
      Math.abs(pt.lon - newPt.lon) < 1e-9
    )) {
      track.splice(idx, 0, newPt);
    }
    return idx;
  }

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

      // Clone track for insertion
      const updatedTrack = [...base.trkpts];

      // Snap waypoints and cues to interpolated trackpoint (insert if necessary!)
      const snapped = allWaypoints.map(pt => {
        const interpPt = interpolateTrackpoint(updatedTrack, pt);
        const idx = insertTrackpoint(updatedTrack, {
          lat: interpPt.lat,
          lon: interpPt.lon,
          ele: interpPt.ele,
          distance: interpPt.distance
        });
        return {
          ...interpPt,
          name: pt.name,
          type: pt.type,
          notes: pt.name,
          snapIdx: idx
        };
      });

      // Parse CSV and create cues
      const cues = parseCSV(csvText).map(row => {
        // Find by closest trackpoint index using distance in KM
        const cue = {
          name: row.name,
          lat: null,
          lon: null,
          distance: row.distance * 1000 // CSV is in km
        };
        // Interpolate based on cumulative distance
        let foundIdx = null;
        for (let i = 1; i < updatedTrack.length; i++) {
          if (updatedTrack[i].distance >= cue.distance) {
            foundIdx = i - 1;
            break;
          }
        }
        if (foundIdx !== null) {
          const ptA = updatedTrack[foundIdx], ptB = updatedTrack[foundIdx + 1];
          const t = (cue.distance - ptA.distance) / (ptB.distance - ptA.distance);
          cue.lat = ptA.lat + (ptB.lat - ptA.lat) * t;
          cue.lon = ptA.lon + (ptB.lon - ptA.lon) * t;
          cue.ele = parseFloat(ptA.ele) + (parseFloat(ptB.ele) - parseFloat(ptA.ele)) * t;
        } else {
          cue.lat = updatedTrack[updatedTrack.length - 1].lat;
          cue.lon = updatedTrack[updatedTrack.length - 1].lon;
          cue.ele = updatedTrack[updatedTrack.length - 1].ele;
        }
        const idx = insertTrackpoint(updatedTrack, cue);
        return {
          ...cue,
          type: guessCueType(row.name),
          notes: `${row.name} (${row.distance} km)`,
          snapIdx: idx
        };
      });

      const allCues = [...snapped, ...cues];

      // Progressive time assignment!
      const avgSpeed = 4.16; // meters/sec
      const startTime = new Date("2025-07-14T08:30:51Z");
      updatedTrack.forEach(pt => {
        pt.time = new Date(startTime.getTime() + (pt.distance / avgSpeed) * 1000).toISOString();
      });

      // Ensure each cue's snapIdx matches the inserted trackpoint and its time
      // This is handled in buildTCX now

      setTcx(buildTCX(updatedTrack, allCues));
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
