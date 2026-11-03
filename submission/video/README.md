# Demo video sources

How `neighborly-demo.mp4` was made:

1. `capture.mjs` drives the live app (https://neighborly-church.vercel.app) in headless Chrome at 1920x1080. It types ZIP 33919, picks Spanish and Haitian Creole, loads the Grace Fellowship sample, runs real translations, edits one Spanish block to show a flagged change, walks the reviewer approval gate, and opens the printable flyers. It saves timed screenshots and the time of every step (`node capture.mjs OUTDIR live`). Headless Chrome has no pointer, so an orange ring marks each click.
2. `tts.py` reads `script.json` and makes the narration with Piper TTS (LJ Speech voice). The voice is synthetic and the video says so on screen the whole time.
3. `Neighborly.tsx` is the Remotion composition: a 3 second title card, the capture with a label and captions, and an end card with the live URL. It renders 1920x1080 at 30 fps. Long waits in the capture are sped up or cut, and the label says so.
4. `render-chunks.sh` renders the composition in chunks (the shared box runs low on memory), then renders the narration track; ffmpeg joins the chunks and muxes the audio.

Grace Fellowship and everything in the announcement are sample data. No real person's face or voice appears. The mp4 itself is not in git.
