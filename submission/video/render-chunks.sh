#!/bin/bash
set -u
cd /workspace/video-pipeline/rtest
OUT=/workspace/video-pipeline/neighborly/chunks
N=${N:-4452}; STEP=${STEP:-500}; START=${START:-0}
for ((a=START; a<N; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $N ] && b=$((N-1))
  f=$OUT/c$(printf %05d $a).mp4
  [ -s $f ] && continue
  for try in 1 2 3 4 5 6; do
    npx remotion render Neighborly $f --frames=$a-$b --muted --crf=18 --concurrency=${CONC:-2} --browser-executable=/usr/bin/google-chrome --offthreadvideo-cache-size-in-bytes=200000000 --offthreadvideo-threads=1 --log=error && break
    rm -f $f; sleep 20
  done
  [ -s $f ] || { echo "CHUNK FAIL $a"; echo EXIT 1; exit 1; }
  echo "CHUNK OK $a-$b"
done
npx remotion render Neighborly $OUT/audio.wav --codec=wav --browser-executable=/usr/bin/google-chrome --log=error || { echo EXIT 2; exit 2; }
echo EXIT 0
