# Piper TTS for each narrated segment. Writes vo/<id>.wav next to the Remotion public dir and adds "dur" to script.json.
import json, subprocess, wave, os, sys
VO = sys.argv[1] if len(sys.argv) > 1 else 'vo'
s = json.load(open('script.json'))
os.makedirs(VO, exist_ok=True)
for x in s:
    if not x['text']:
        x['dur'] = x.get('fixed', 3); continue
    out = f"{VO}/{x['id']}.wav"
    say = x.get('say', x['text']).replace('6:30', 'six thirty').replace('C16001', 'C 1 6 0 0 1').replace('1909', 'nineteen oh nine')
    subprocess.run(["/workspace/video-pipeline/.venv/bin/piper", "-m", "/workspace/video-pipeline/en_US-ljspeech-high.onnx", "-f", out, "--sentence-silence", "0.35"], input=say.encode(), check=True, capture_output=True)
    w = wave.open(out); x['dur'] = round(w.getnframes() / w.getframerate(), 2)
    print(x['id'], x['dur'], flush=True)
json.dump(s, open('script.json', 'w'), indent=1)
print("total", round(sum(x['dur'] + (0 if x.get('fixed') else 0.55) for x in s), 1))
