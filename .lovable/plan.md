# Add Faisalabad Map Layer

## Implementation
- Add the uploaded Faisalabad XYZ/WMTS source as a selectable `Faisalabad` option in the existing map layer chooser alongside Google Hybrid and Google Satellite.
- Configure it as a Web Mercator tile layer using the source URL embedded in the uploaded file, with supported zoom levels 0–19.
- Keep Google Hybrid as the default map and bump the offline cache version so the updated map loads immediately.

## Verification
- Open the survey map, select `Faisalabad`, and confirm its tiles load and the existing drawing tools still work.
