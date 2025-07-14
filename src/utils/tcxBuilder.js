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
          <DistanceMeters>${pt.distance !== undefined && !isNaN(pt.distance) ? Number(pt.distance).toFixed(1) : "0.0"}</DistanceMeters>
        </Trackpoint>`).join("\n")}
      </Track>
      <CoursePoints>
        ${coursePoints.map(cp => {
          // Find trackpoint index matching cue (by snapIdx or by distance)
          const idx = typeof cp.snapIdx === "number"
            ? cp.snapIdx
            : track.findIndex(
                pt => Math.abs(pt.distance - cp.distance) < 1e-2
              );
          const trkPt = track[Math.floor(idx)] || track[0];
          const time = trkPt.time;
          const distance = trkPt.distance !== undefined && !isNaN(trkPt.distance) ? Number(trkPt.distance).toFixed(1) : "0.0";
          return `<CoursePoint>
          <Name>${encode(cp.name)}</Name>
          <Time>${time}</Time>
          <Position>
            <LatitudeDegrees>${cp.lat}</LatitudeDegrees>
            <LongitudeDegrees>${cp.lon}</LongitudeDegrees>
          </Position>
          <PointType>${tcxCueTypeMap[cp.type] || "Generic"}</PointType>
          <Notes>${encode(cp.notes || cp.name)}</Notes>
          <DistanceMeters>${distance}</DistanceMeters>
        </CoursePoint>`;
        }).join("\n")}
      </CoursePoints>
    </Course>
  </Courses>
</TrainingCenterDatabase>`;
}
