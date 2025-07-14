// Simple CSV parser for 'Name,Distance'
export function parseCSV(csv) {
  return csv
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, distance] = line.split(",");
      return {
        name: name?.trim() || "",
        distance: parseFloat(distance)
      };
    })
    .filter(row => row.name && !isNaN(row.distance));
}
