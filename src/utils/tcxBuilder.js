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
  // times and distances are now properties on track
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Courses>
    <Course>
      <Name>${encode(courseName)}</Name>
      <Track>
        ${track.map(pt => `<Trackpoint>
          <Time>${pt.time}</Time>
          <Position>
            <LatitudeDegrees>${pt.lat}</LatitudeDegrees>
            <LongitudeDegrees>${pt.lon}</LongitudeDegrees>
          </Position>
          ${pt.ele !== undefined && !isNaN(pt.ele) ? `<AltitudeMeters>${Number(pt.ele).toFixed(1)}</AltitudeMeters>` : ""}
          <DistanceMeters>${pt.distance.toFixed(1)}</DistanceMeters>
        </Trackpoint>`).join("\n")}
      </Track>
      <CoursePoints>
        ${coursePoints.map(cp => {
          // Find trackpoint index matching cue
          const idx = typeof cp.snapIdx === "number"
            ? cp.snapIdx
            : track.findIndex(
                pt =>
                  Math.abs(pt.lat - cp.lat) < 1e-8 &&
                  Math.abs(pt.lon - cp.lon) < 1e-8
              );
          const time = track[Math.floor(idx)]?.time || track[0].time;
          return `<CoursePoint>
          <Name>${encode(cp.name)}</Name>
          <Time>${time}</Time>
          <Position>
            <LatitudeDegrees>${cp.lat}</LatitudeDegrees>
            <LongitudeDegrees>${cp.lon}</LongitudeDegrees>
          </Position>
          <PointType>${tcxCueTypeMap[cp.type] || "Generic"}</PointType>
          <Notes>${encode(cp.notes || cp.name)}</Notes>
        </CoursePoint>`;
        }).join("\n")}
      </CoursePoints>
    </Course>
  </Courses>
</TrainingCenterDatabase>`;
}
