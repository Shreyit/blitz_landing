# Registration region map

The registration form renders state and union-territory polygons from Vardhan Maps GeoJSON:
https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/main/src/data/generated/states.low.json

Source: https://github.com/Vardhan-Systems/vardhan-maps
Map data is derived from OpenStreetMap and licensed under ODbL 1.0. The map displays
the required © OpenStreetMap contributors attribution linking to
https://www.openstreetmap.org/copyright. See the upstream ATTRIBUTION.md for data provenance.

The browser loads the boundary data on demand. Network failures display a retry
control and leave the required state/UT selector available. No third-party map
library, tracking, location permission, or tile service is used. This is a general
purpose state selector, not an official or survey-grade map.

Map controls offer 100–500% zoom, drag panning, and reset without clearing the
selected region. Selecting Andaman and Nicobar Islands on the map or from the
dropdown fits its complete archipelago into view. All regions and small-territory
markers use the same default green shade and shared hover/selection styles.
Projected state bounds keep panning within the country frame.

Canonical registration options are shared between the frontend and backend in
`shared/registration-options.json`.
