/**
 * tools/presets/render-images.js - task 170. NOT a test (the glob runs test-*.js only): the browser half of the preview-image pipeline, to inject into the Browser pane (Chromium) on a page
 * of a served Studio that has just loaded the preset (open /p/<slug>/ of a served website in a tab with an empty sessionStorage, or the Studio with the preset restored; wait about 4 s).
 *   presetImageCapture()           -> { svg, png }   svg = generateSVGString() (raw, the whole tiling), png = the canvas drawn at 600 x 600 (smooth), as a data URL
 *   presetImageCompare(finalSvg)   -> { W, diffPixels, pct, maxDelta, meanDelta, strong64 }   the FINAL (clipped) SVG text drawn at the canvas size against the Studio canvas, pixel for pixel
 * The node half is tools/presets/clip-svg.js (raw -> final); the pins are tools/presets/svg-pixel-pins.json. Method of the task S1 comparison (SVG against canvas, 1200 x 1200, device pixels 2).
 */
window.presetImageCapture = function () {
    const cv = document.querySelector('#canvas-container canvas');
    const c = document.createElement('canvas'); c.width = c.height = 600;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 600); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, 600, 600);
    return { svg: generateSVGString(), png: c.toDataURL('image/png') };
};
window.presetImageCompare = async function (finalSvg) {
    const cv = document.querySelector('#canvas-container canvas'), W = cv.width;
    const img = new Image(); img.src = URL.createObjectURL(new Blob([finalSvg], { type: 'image/svg+xml' })); await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = W;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, W); x.drawImage(img, 0, 0, W, W);
    const A = cv.getContext('2d').getImageData(0, 0, W, W).data, B = x.getImageData(0, 0, W, W).data;
    let n = 0, mx = 0, sum = 0, strong = 0;
    for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 0) { n++; sum += d; if (d > mx) mx = d; if (d >= 64) strong++; } }
    return { W, diffPixels: n, pct: +(100 * n / (W * W)).toFixed(3), maxDelta: mx, meanDelta: n ? +(sum / n).toFixed(1) : 0, strong64: strong };
};
