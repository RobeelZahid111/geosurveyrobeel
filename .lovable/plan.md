# Numbered Polygon Drawing and Live Location

## What will change
- Show a compact numbered square at every polygon vertex while drawing and after completion.
- Style the active drawing line as a clearly visible dotted guide, including the moving segment to the pointer.
- Add a **Live GPS** toggle beside the existing GPS action.
- While Live GPS is active, continuously update the position marker, accuracy circle, coordinates, and map view; allow stopping without leaving stale tracking active.
- Keep numbering synchronized when polygons are created, edited, imported, cut, merged, divided, deleted, restored, or loaded from saved work.

## Technical details
- Extend the existing Leaflet drawing events rather than replacing the current draw tools.
- Use lightweight non-interactive Leaflet labels for vertex numbers so map taps and edits still work.
- Use `navigator.geolocation.watchPosition` with high accuracy, a single reusable marker/accuracy circle, and explicit cleanup.
- Refresh the PWA cache version and verify the drawing and live-location controls on a mobile viewport.