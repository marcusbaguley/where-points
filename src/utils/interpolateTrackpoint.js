export function interpolateTrackpoint(track, cue) {
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = v => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let minDist = Infinity, segIdx = 0, proj = null;
  for (let i = 0; i < track.length - 1; i++) {
    const ptA = track[i], ptB = track[i + 1];
    const dAB = haversine(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
    const dACue = haversine(ptA.lat, ptA.lon, cue.lat, cue.lon);
    const dBCue = haversine(ptB.lat, ptB.lon, cue.lat, cue.lon);
    if (dACue <= dAB && dBCue <= dAB) {
      const t = dAB === 0 ? 0 : dACue / dAB;
      const lat = ptA.lat + (ptB.lat - ptA.lat) * t;
      const lon = ptA.lon + (ptB.lon - ptA.lon) * t;
      const eleA = parseFloat(ptA.ele || 0);
      const eleB = parseFloat(ptB.ele || 0);
      const ele = eleA + (eleB - eleA) * t;
      const distA = ptA.distance || 0;
      const distB = ptB.distance || 0;
      const distance = distA + (distB - distA) * t;
      const distToCue = haversine(lat, lon, cue.lat, cue.lon);
      if (distToCue < minDist) {
        minDist = distToCue;
        segIdx = i;
        proj = { lat, lon, ele, distance, t };
      }
    }
  }

  if (!proj) {
    let minDist = Infinity, nearestIdx = 0;
    track.forEach((trkpt, idx) => {
      const d = haversine(cue.lat, cue.lon, trkpt.lat, trkpt.lon);
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    });
    return { ...track[nearestIdx], snapIdx: nearestIdx };
  }

  return {
    lat: proj.lat,
    lon: proj.lon,
    ele: proj.ele,
    distance: proj.distance,
    snapIdx: segIdx + proj.t
  };
}
