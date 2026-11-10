// Test script to verify zoom math and dimension calculations for 300 DPI export
const widthMm = 125;
const heightMm = 240;
const dpi = 300;

const mmPerInch = 25.4;
const widthPx = Math.round((widthMm / mmPerInch) * dpi);
const heightPx = Math.round((heightMm / mmPerInch) * dpi);

console.log(`Dimensions for ${widthMm}x${heightMm} mm at ${dpi} DPI:`);
console.log(`widthPx: ${widthPx}, heightPx: ${heightPx}`);
console.log(`Aspect ratio target: ${(widthMm / heightMm).toFixed(6)}`);
console.log(`Aspect ratio pixels: ${(widthPx / heightPx).toFixed(6)}`);
console.log(`Discrepancy: ${Math.abs((widthMm / heightMm) - (widthPx / heightPx)).toFixed(6)}`);

const screenWidth = 320;
const scaleFactor = widthPx / screenWidth;
const deltaZoom = Math.log2(scaleFactor);
console.log(`Screen width: ${screenWidth}px -> scaleFactor: ${scaleFactor.toFixed(2)}x -> deltaZoom: +${deltaZoom.toFixed(2)} levels`);
