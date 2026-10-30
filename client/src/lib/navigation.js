export function tripNavigationUrl(destination, location) {
  const target = String(destination || "").trim();
  if (!target) throw new Error("This trip does not have a destination yet.");

  const params = new URLSearchParams({
    api: "1",
    destination: target,
    travelmode: "driving",
    dir_action: "navigate"
  });
  if (location?.latitude != null && location?.longitude != null) {
    params.set("origin", `${location.latitude},${location.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openTripNavigation(destination, location) {
  window.open(tripNavigationUrl(destination, location), "_blank", "noopener,noreferrer");
}
