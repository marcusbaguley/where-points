import React, { useState } from "react";
import { parseGPX } from "./utils/gpxParser";
import { parseCSV } from "./utils/csvParser";
import { interpolateTrackpoint } from "./utils/interpolateTrackpoint";
import { buildTCX } from "./utils/tcxBuilder";
import Button from "./components/Button";
import Card from "./components/Card";

// --- Helper function to build GPX with waypoints, now uses baseName ---
function buildGPXWaypointsFromCSV(csvCues, baseName) {
  const sortedCues = [...csvCues].sort((a, b) => a.distance - b.distance);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="${baseName}" version="1.1"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${baseName} CSV Cues as GPX Waypoints</name>
    <desc>All CSV cues snapped to the route as GPX waypoints</desc>
  </metadata>
  ${sortedCues
    .map(
      (cue, i) => `<wpt lat="${cue.lat}" lon="${cue.lon}">
    <name>${cue.name}</name>
    <desc>${cue.notes || cue.name}</desc>
    ${cue.ele !== undefined && !isNaN(cue.ele) ? `<ele>${Number(cue.ele).toFixed(1)}</ele>` : ""}
    <type>waypoint</type>
  </wpt>`
    )
    .join("\n  ")}
</gpx>`;
}

export default function App() {
  const [baseGpx, setBaseGpx] = useState(null);
  const [poiGpx, setPoiGpx] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [tcx, setTcx] = useState("");
  const [csvCuesWithCoords, setCsvCuesWithCoords] = useState([]);
  const [error, setError] = useState("");
  const [splitMarkers, setSplitMarkers] = useState(""); // e.g. "100,255,500"
  const [splitFiles, setSplitFiles] = useState([]); // array of {name,tcx}
  const [baseName, setBaseName] = useState(""); // Track Base Name

  // Update GPX handler to set baseName from filename
  function handleBaseGpxUpload(e) {
    const file = e.target.files[0];
    setBaseGpx(file);
    if (file) {
      // Get filename without extension
      const name = file.name.replace(/\.[^/.]+$/, "");
      setBaseName(name);
    }
  }

  function insertTrackpoint(track, newPt) {
    let idx = track.findIndex(pt => pt.distance > newPt.distance);
    if (idx === -1) idx = track.length;
    if (
      !track.some(
        pt =>
          Math.abs(pt.lat - newPt.lat) < 1e-9 &&
          Math.abs(pt.lon - newPt.lon) < 1e-9
      )
    ) {
      track.splice(idx, 0, newPt);
    }
    return idx;
  }

  const handleProcess = async () => {
    setError("");
    setSplitFiles([]); // reset split files when re-processing
    if (!baseGpx) {
      setError("Base GPX is required.");
      return;
    }
    try {
      const base = parseGPX(await baseGpx.text());
      const poi = poiGpx ? parseGPX(await poiGpx.text()) : { waypoints: [] };

      const allWaypoints = [
        ...(base.waypoints || []),
        ...(base.rtepts || []),
        ...(poi.waypoints || [])
      ];

      const updatedTrack = [...base.trkpts];

      const snapped = allWaypoints.map(pt => {
        const interpPt = interpolateTrackpoint(updatedTrack, pt);
        const idx = insertTrackpoint(updatedTrack, {
          lat: interpPt.lat,
          lon: interpPt.lon,
          ele: typeof interpPt.ele === "number" ? interpPt.ele : parseFloat(interpPt.ele),
          distance: interpPt.distance
        });
        return {
          ...interpPt,
          name: pt.name,
          type: pt.type,
          notes: pt.name,
          snapIdx: idx,
          distance: interpPt.distance
        };
      });

      const cues = parseCSV(csvText).map(row => {
        const cue = {
          name: row.name,
          lat: null,
          lon: null,
          distance: row.distance * 1000
        };
        let foundIdx = null;
        for (let i = 1; i < updatedTrack.length; i++) {
          if (updatedTrack[i].distance >= cue.distance) {
            foundIdx = i - 1;
            break;
          }
        }
        if (foundIdx !== null) {
          const ptA = updatedTrack[foundIdx],
            ptB = updatedTrack[foundIdx + 1];
          const t = (cue.distance - ptA.distance) / (ptB.distance - ptA.distance);
          cue.lat = ptA.lat + (ptB.lat - ptA.lat) * t;
          cue.lon = ptA.lon + (ptB.lon - ptA.lon) * t;
          cue.ele =
            parseFloat(ptA.ele) +
            (parseFloat(ptB.ele) - parseFloat(ptA.ele)) * t;
        } else {
          cue.lat = updatedTrack[updatedTrack.length - 1].lat;
          cue.lon = updatedTrack[updatedTrack.length - 1].lon;
          cue.ele = parseFloat(updatedTrack[updatedTrack.length - 1].ele);
        }
        const idx = insertTrackpoint(updatedTrack, {
          lat: cue.lat,
          lon: cue.lon,
          ele: cue.ele,
          distance: cue.distance
        });
        return {
          ...cue,
          type: guessCueType(row.name),
          notes: `${row.name}`,
          snapIdx: idx,
          distance: cue.distance
        };
      });

      // Sort cues by distance
      const allCues = [...snapped, ...cues].sort((a, b) => a.distance - b.distance);
      cues.sort((a, b) => a.distance - b.distance);

      const avgSpeed = 4.16; // meters/sec
      const startTime = new Date("2025-07-14T08:30:51Z");
      updatedTrack.forEach(pt => {
        pt.time = new Date(
          startTime.getTime() + (pt.distance / avgSpeed) * 1000
        ).toISOString();
      });

      setTcx(buildTCX(updatedTrack, allCues, baseName));
      setCsvCuesWithCoords(cues);
      setSplitFiles([]); // clear splits on new process
    } catch (err) {
      setError("Failed to process: " + err.message);
      console.error("[App] Error in processing:", err);
    }
  };

  // --- Split TCX feature ---
  function handleSplitTCX() {
    if (!tcx) return;
    const splitPoints = splitMarkers
      .split(",")
      .map(s => parseFloat(s.trim()))
      .filter(s => !isNaN(s) && s > 0)
      .map(km => km * 1000);
    if (!splitPoints.length) {
      setError("Please enter valid split markers in KM (comma separated).");
      return;
    }

    // parse the last generated route (as in handleProcess)
    const parser = new DOMParser();
    const doc = parser.parseFromString(tcx, "application/xml");
    const trackpoints = Array.from(doc.getElementsByTagNameNS("*", "Trackpoint")).map(tp => ({
      lat: parseFloat(tp.getElementsByTagNameNS("*", "LatitudeDegrees")[0].textContent),
      lon: parseFloat(tp.getElementsByTagNameNS("*", "LongitudeDegrees")[0].textContent),
      ele: tp.getElementsByTagNameNS("*", "AltitudeMeters").length
        ? parseFloat(tp.getElementsByTagNameNS("*", "AltitudeMeters")[0].textContent)
        : undefined,
      distance: parseFloat(tp.getElementsByTagNameNS("*", "DistanceMeters")[0].textContent),
      time: tp.getElementsByTagNameNS("*", "Time")[0].textContent
    }));
    const coursepoints = Array.from(doc.getElementsByTagNameNS("*", "CoursePoint")).map(cp => ({
      name: cp.getElementsByTagNameNS("*", "Name")[0].textContent,
      lat: parseFloat(cp.getElementsByTagNameNS("*", "LatitudeDegrees")[0].textContent),
      lon: parseFloat(cp.getElementsByTagNameNS("*", "LongitudeDegrees")[0].textContent),
      ele: undefined, // optional, not in CoursePoint
      distance: cp.getElementsByTagNameNS("*", "DistanceMeters").length
        ? parseFloat(cp.getElementsByTagNameNS("*", "DistanceMeters")[0].textContent)
        : undefined,
      time: cp.getElementsByTagNameNS("*", "Time")[0].textContent,
      type: cp.getElementsByTagNameNS("*", "PointType")[0].textContent,
      notes: cp.getElementsByTagNameNS("*", "Notes")[0].textContent
    }));
    // always add the last distance as final split
    const allSplitPoints = [...splitPoints, trackpoints[trackpoints.length - 1].distance];
    const sections = [];
    let start = 0;
    allSplitPoints.forEach((end, i) => {
      // get trackpoints for this section (inclusive of first, up to end)
      const sectionTrack = trackpoints.filter(pt => pt.distance >= start && pt.distance <= end);
      if (sectionTrack.length < 2) {
        start = end;
        return; // skip empty sections
      }
      // adjust distances so first is 0
      const baseDistance = sectionTrack[0].distance;
      sectionTrack.forEach(pt => {
        pt.distance -= baseDistance;
      });
      // get coursepoints in this section (with distance in section range)
      const sectionCourse = coursepoints.filter(
        cp => cp.distance >= start && cp.distance <= end
      ).map(cp => ({
        ...cp,
        distance: cp.distance - baseDistance
      }));
      // build TCX for this section, use baseName for both file and course name
      const tcxSection = buildTCX(sectionTrack, sectionCourse, `${baseName} Part ${i + 1}`);
      sections.push({
        name: `${baseName}-part-${i + 1}.tcx`,
        tcx: tcxSection
      });
      start = end;
    });
    setSplitFiles(sections);
    setError(""); // clear any error
  }

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
        <Card title="Info">
          <p>
            Upload your base GPX (with track and cues), optional waypoints GPX,
            and paste any resupply, cues as description, kilometer marker. All cues and waypoints will be snapped to the
            track and exported as a Garmin-compatible TCX.
          </p>
          <p>
            You can also download the CSV cues (with matched coordinates) as GPX waypoints.
          </p>
          <p>
            <b>Split feature:</b> To split your TCX into sections, enter KM markers and click "Split & Download".
          </p>
        </Card>
        <Card title="Track Base Name">
          <input
            type="text"
            value={baseName}
            onChange={e => setBaseName(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            placeholder="Route name"
          />
        </Card>
        <Card title="1. Upload Base GPX">
          <input
            type="file"
            accept=".gpx"
            onChange={handleBaseGpxUpload}
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
              download={`${baseName || "where-points"}.tcx`}
              className="mb-4 mr-4 inline-block"
            >
              <Button>Download TCX</Button>
            </a>
            {csvCuesWithCoords.length > 0 && (
              <a
                href={`data:application/gpx+xml,${encodeURIComponent(
                  buildGPXWaypointsFromCSV(csvCuesWithCoords, baseName)
                )}`}
                download={`${baseName || "where-points"}-csv-cues-waypoints.gpx`}
                className="mb-4 mr-4 inline-block"
              >
                <Button>Download CSV points into GPX</Button>
              </a>
            )}
            <div className="mt-4">
              <label className="block mb-1 font-medium">
                Split file up at KM markers (comma separated):
              </label>
              <input
                className="border rounded px-2 py-1 w-72"
                type="text"
                value={splitMarkers}
                onChange={e => setSplitMarkers(e.target.value)}
                placeholder="e.g. 100,255,500"
              />
              <Button style={{ marginLeft: 8 }} onClick={handleSplitTCX}>
                Split & Download
              </Button>
            </div>
            {splitFiles.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="font-semibold w-full mb-2">Split TCX Downloads:</div>
                {splitFiles.map((file, i) => (
                  <a
                    key={file.name}
                    href={`data:application/xml,${encodeURIComponent(file.tcx)}`}
                    download={file.name}
                    className="inline-block"
                  >
                    <Button>Download {file.name}</Button>
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
