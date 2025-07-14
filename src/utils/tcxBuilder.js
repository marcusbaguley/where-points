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
  // Use track data as is (with interpolated and original points)
  const times = track.map(pt => pt.time || startTimeISO || new Date().toISOString());
  const distances = track.map(pt => pt.distance || 0);

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
            // Use snapIdx as index in track, or fallback to 0
            const idx = typeof cp.snapIdx === "number" ? cp.snapIdx : 0;
            return `<CoursePoint>
          <Name>${encode(cp.name)}</Name>
          <Time>${times[Math.floor(idx)] || times[0]}</Time>
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
