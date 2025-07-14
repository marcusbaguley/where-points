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
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildTCX(track, coursePoints) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Courses>
    <Course>
      <Name>where-points route</Name>
      <Track>
        ${track
          .map(
            pt => `<Trackpoint>
              <Position>
                <LatitudeDegrees>${pt.lat}</LatitudeDegrees>
                <LongitudeDegrees>${pt.lon}</LongitudeDegrees>
              </Position>
              ${pt.ele ? `<AltitudeMeters>${pt.ele}</AltitudeMeters>` : ""}
            </Trackpoint>`
          )
          .join("\n")}
      </Track>
      <CoursePoints>
        ${coursePoints
          .map(
            (cp, i) => `<CoursePoint>
              <Name>${encode(cp.name)}</Name>
              <Time>${new Date().toISOString()}</Time>
              <Position>
                <LatitudeDegrees>${cp.lat}</LatitudeDegrees>
                <LongitudeDegrees>${cp.lon}</LongitudeDegrees>
              </Position>
              <PointType>${
                tcxCueTypeMap[cp.type] || "Generic"
              }</PointType>
              <Notes>${encode(cp.notes || cp.name)}</Notes>
            </CoursePoint>`
          )
          .join("\n")}
      </CoursePoints>
    </Course>
  </Courses>
</TrainingCenterDatabase>`;
}
