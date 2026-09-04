/* Parses (and gunzips) khasra GeoJSON off the main thread so the map never freezes. */
self.onmessage = async function (ev) {
  var id = ev.data && ev.data.id;
  try {
    var buf = ev.data.buffer;
    var text;
    if (ev.data.gzip) {
      if (typeof DecompressionStream === 'undefined') throw new Error('gzip not supported in this browser');
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([buf]).stream().pipeThrough(ds);
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(buf);
    }
    var geo = JSON.parse(text);
    self.postMessage({ id: id, ok: true, geojson: geo });
  } catch (e) {
    self.postMessage({ id: id, ok: false, error: (e && e.message) || String(e) });
  }
};
