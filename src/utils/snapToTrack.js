// Haversine distance
function haversine(lat1, lon1, lat2, lon2) {
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
}

// Snap POI or cue to nearest track point
export function snapToTrack(pt, track) {
  let minDist = Infinity, nearestIdx = 0;
  track.forEach((trkpt, idx) => {
    const d = haversine(pt.lat, pt.lon, trkpt.lat, trkpt.lon);
    if (d < minDist) {
      minDist = d;
      nearestIdx = idx;
    }
  });
  // Log summary for each snap (can be verbose if many points)
  console.log(
    `[Snap] Snapped "${pt.name || pt.type || "unknown"}" to track index ${nearestIdx} (distance: ${minDist.toFixed(1)}m)`
  );
  return { ...track[nearestIdx], snapIdx: nearestIdx };
}
