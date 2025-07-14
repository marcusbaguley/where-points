// Minimal GPX parser for waypoints, routepoints, and track
export function parseGPX(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");

  // Track points
  const trkpts = Array.from(xml.getElementsByTagName("trkpt")).map(pt => ({
    lat: parseFloat(pt.getAttribute("lat")),
    lon: parseFloat(pt.getAttribute("lon")),
    ele: pt.getElementsByTagName("ele")[0]?.textContent,
  }));

  // Waypoints
  const waypoints = Array.from(xml.getElementsByTagName("wpt")).map(wpt => ({
    name: wpt.getElementsByTagName("name")[0]?.textContent || "Waypoint",
    lat: parseFloat(wpt.getAttribute("lat")),
    lon: parseFloat(wpt.getAttribute("lon")),
    type: wpt.getElementsByTagName("type")[0]?.textContent || "Generic"
  }));

  // Routepoints (used for cues)
  const rtepts = Array.from(xml.getElementsByTagName("rtept")).map(rte => ({
    name: rte.getElementsByTagName("name")[0]?.textContent || "Cue",
    lat: parseFloat(rte.getAttribute("lat")),
    lon: parseFloat(rte.getAttribute("lon")),
    type: rte.getElementsByTagName("type")[0]?.textContent || "Generic"
  }));

  return { trkpts, waypoints, rtepts };
}
