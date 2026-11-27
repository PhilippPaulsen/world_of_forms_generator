/**
 * tools/presets/measure-pixels.js - task 160. NOT a test (the glob only runs test-*.js): the three steps, as code to inject into the Browser pane
 * (Chromium) on a page of a served generator or Studio, that measured tools/presets/pixel-pins.json. Run per preset, each step in its own call,
 * waiting about 2 s after every reload:
 *   1  presetPixelStep1(sessionText)   puts the preset into this tab's autosave slot (href = this page's URL) and reloads: the page restores it
 *   2  presetPixelStep2()              keeps the canvas of the restored page (PNG in sessionStorage), flushes the autosave writer, reloads
 *   3  presetPixelStep3()              -> { w, h, diffPixels, maxDelta }  the canvas of the page restored from ITS OWN autosave against step 2's canvas
 *                                      (a pixel counts when any of R, G, B differs; maxDelta = the largest channel difference)
 * Method note: task 156 measured "freshly built against loaded from session" for the rotation pattern (square, seed 4242: about 20 px, max 3). A preset is never
 * built by clicks, so the comparable measurement here is "restored from the preset against restored from the autosave of that restore" (the session
 * write + read + apply path a visitor's reload takes). The two differ in what they exercise; see reports/160.md.
 */
window.presetPixelStep1 = function (text) {
    sessionStorage.setItem('wof:session', JSON.stringify({ v: 1, href: location.origin + location.pathname, at: Date.now(), snapshot: text }));
    setTimeout(() => location.reload(), 50);
};
window.presetPixelStep2 = function () {
    sessionStorage.setItem('probeA', document.querySelector('#canvas-container canvas').toDataURL());
    if (window.sessionWriter) window.sessionWriter.flush();
    setTimeout(() => location.reload(), 100);
};
window.presetPixelStep3 = async function () {
    const cv = document.querySelector('#canvas-container canvas'), a = new Image();
    a.src = sessionStorage.getItem('probeA'); await a.decode();
    const w = cv.width, h = cv.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(a, 0, 0);
    const A = x.getImageData(0, 0, w, h).data, B = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let diffPixels = 0, maxDelta = 0;
    for (let i = 0; i < A.length; i += 4) { let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A[i + k] - B[i + k])); if (d > 0) { diffPixels++; if (d > maxDelta) maxDelta = d; } }
    return { w, h, diffPixels, maxDelta };
};
