const tcxCueTypeMap = {
  "Slight Right": "Right",
  "Slight Left": "Left",
  "Sharp Right": "SharpRight",
  "Sharp Left": "SharpLeft",
  "Right": "Right",
  "Left": "Left",
  "Straight": "Straight",
  "Food": "Food",
  "Resupply": "Food",
  "Hotel": "Generic",
  "Generic": "Generic"
};

function encode(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildTCX(track, coursePoints, courseName = "where-points route", startTimeISO = null) {
  // Compute cumulative distance for each track point
  let distances = [0];
  for (let i = 1; i < track.length; i++) {
    const d = window.haversine(
      track[i - 1].lat,
      track[i - 1].lon,
      track[i].lat,
      track[i].lon
    );
    distances.push(distances[i - 1] + d);
  }

  // Generate times: startTime + X seconds, assuming e.g. 15km/h avg speed
  const avgSpeed = 4.16; // m/s (~15km/h)
  const baseTime = startTimeISO ? new Date(startTimeISO) : new Date();
  let times = [baseTime.toISOString()];
  for (let i = 1; i < distances.length; i++) {
    const seconds = distances[i] / avgSpeed;
    const time = new Date(baseTime.getTime() + seconds * 1000);
    times.push(time.toISOString());
  }

  console.log(
    `[TCX] Building TCX: ${track.length} track points, ${coursePoints.length} course points, course name="${courseName}"`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Courses>
    <Course>
      <Name>${encode(courseName)}</Name>
      <Track>
        ${track
          .map(
            (pt, i) => `<Trackpoint>
          <Time>${times[i]}</Time>
          <Position>
            <LatitudeDegrees>${pt.lat}</LatitudeDegrees>
            <LongitudeDegrees>${pt.lon}</LongitudeDegrees>
          </Position>
          ${pt.ele ? `<AltitudeMeters>${pt.ele}</AltitudeMeters>` : ""}
          <DistanceMeters>${distances[i].toFixed(1)}</DistanceMeters>
        </Trackpoint>`
          )
          .join("\n")}
      </Track>
      <CoursePoints>
        ${coursePoints
          .map(cp => {
            const snapIdx =
              typeof cp.snapIdx === "number"
                ? cp.snapIdx
                : (cp.nearestTrackIdx || 0);
            return `<CoursePoint>
          <Name>${encode(cp.name)}</Name>
          <Time>${times[snapIdx] || times[0]}</Time>
          <Position>
            <LatitudeDegrees>${cp.lat}</LatitudeDegrees>
            <LongitudeDegrees>${cp.lon}</LongitudeDegrees>
          </Position>
          <PointType>${tcxCueTypeMap[cp.type] || "Generic"}</PointType>
          <Notes>${encode(cp.notes || cp.name)}</Notes>
        </CoursePoint>`;
          })
          .join("\n")}
      </CoursePoints>
    </Course>
  </Courses>
</TrainingCenterDatabase>`;
}
