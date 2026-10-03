# Bundled English OCR assets

`eng.traineddata` comes from the official Tesseract `tessdata_fast` English model:
https://github.com/tesseract-ocr/tessdata_fast/blob/main/eng.traineddata

Downloaded 2026-10-03. SHA-256:
`7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`.
Its Apache 2.0 license is preserved in `TESSDATA-LICENSE`.

`npm run images:prepare` copies the worker and WebAssembly cores from locked
`tesseract.js` / `tesseract.js-core` dependencies. Generated JS/WASM are ignored
in Git and included in production builds. Their licenses are preserved beside
this file. OCR paths resolve to these bundled assets, never a remote CDN.

English OCR only in this slice. Selected image previews and reviewed extracted
text stay in the local conversation; the chat model receives text, not pixels.
