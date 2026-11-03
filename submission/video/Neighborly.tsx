import React from 'react';
import {AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import data from './neighborly-data.json';

type Seg = {id: string; text: string; dur: number; clips: number[][]; label: string; layout: string; fixed?: number};
const FPS = 30;
const GAP = 0.55;
const END_HOLD = 2;
export const nsegs = (data as Seg[]).map((s) => ({
  ...s,
  frames: Math.ceil((s.fixed ? s.fixed : s.dur + GAP + (s.layout === 'end' ? END_HOLD : 0)) * FPS),
}));
export const NTOTAL = nsegs.reduce((a, s) => a + s.frames, 0);

const font = 'Inter, "Helvetica Neue", Arial, sans-serif';
const serif = 'Georgia, "Times New Roman", serif';
const BG = '#14201c';
const INK = '#f4f1ea';
const MUTE = '#a9b3ad';
const ACCENT = '#8fd3b6';
const WARM = '#f2c98a';
const PANE = {x: 192, y: 70, w: 1536, h: 864};

const fadeIn = (f: number, delay = 0) => ({
  opacity: interpolate(f, [delay, delay + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  transform: `translateY(${interpolate(f, [delay, delay + 12], [12, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
});

const Logo: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.24, background: '#1f6b52', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="#fff" /></svg>
  </div>
);

const Captions: React.FC<{text: string; frames: number}> = ({text, frames}) => {
  const f = useCurrentFrame();
  const parts = text.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  const total = parts.reduce((a, p) => a + p.length, 0);
  const speech = frames - GAP * FPS;
  let acc = 0;
  let current = parts[parts.length - 1];
  for (const p of parts) {
    const end = ((acc + p.length) / total) * speech;
    if (f < end) { current = p; break; }
    acc += p.length;
  }
  return (
    <div style={{position: 'absolute', left: 130, right: 130, bottom: 14, height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: font, fontSize: 34, lineHeight: 1.3, color: INK, fontWeight: 500}}>
      <span style={{background: 'rgba(0,0,0,.6)', padding: '8px 22px', borderRadius: 12}}>{current}</span>
    </div>
  );
};

const Pane: React.FC<{seg: (typeof nsegs)[number]}> = ({seg}) => {
  const avail = seg.frames;
  const srcLen = seg.clips.reduce((a, [s, e]) => a + (e - s) * FPS, 0);
  const rate = Math.max(1, srcLen / avail);
  let offset = 0;
  const pieces = seg.clips.map(([s, e]) => {
    const len = Math.round(((e - s) * FPS) / rate);
    const p = {from: offset, len, start: Math.round(s * FPS), end: Math.round(e * FPS)};
    offset += len;
    return p;
  });
  const last = pieces[pieces.length - 1];
  const src = staticFile('neighborly/cap.mp4');
  const vs = {width: PANE.w, height: PANE.h, display: 'block'} as const;
  return (
    <div style={{position: 'absolute', left: PANE.x, top: PANE.y, width: PANE.w, height: PANE.h, borderRadius: 14, overflow: 'hidden', boxShadow: '0 26px 70px rgba(0,0,0,.5)', outline: '1px solid #2e3b36'}}>
      {pieces.map((p, i) => (
        <Sequence key={i} from={p.from} durationInFrames={p.len} layout="none">
          <OffthreadVideo src={src} startFrom={p.start} endAt={p.end} playbackRate={rate} muted style={vs} />
        </Sequence>
      ))}
      {offset < avail ? (
        <Sequence from={offset} durationInFrames={avail - offset} layout="none">
          <Freeze frame={0}>
            <OffthreadVideo src={src} startFrom={last.end - 1} muted style={vs} />
          </Freeze>
        </Sequence>
      ) : null}
    </div>
  );
};

const Title: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: font, color: INK}}>
      <div style={fadeIn(f)}><Logo size={96} /></div>
      <div style={{...fadeIn(f, 4), fontFamily: serif, fontSize: 104, fontWeight: 600, marginTop: 26}}>Neighborly</div>
      <div style={{...fadeIn(f, 10), fontSize: 40, color: MUTE, marginTop: 8}}>Church announcements in the languages your neighbors speak</div>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const f = useCurrentFrame();
  const items = ['A person approves every block', 'Code checks every number', 'No member data', 'Public-domain scripture only'];
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: font, color: INK, paddingBottom: 130}}>
      <div style={fadeIn(f)}><Logo size={88} /></div>
      <div style={{...fadeIn(f, 6), fontFamily: serif, fontSize: 92, fontWeight: 600, marginTop: 22}}>Neighborly</div>
      <div style={{...fadeIn(f, 14), fontSize: 38, color: MUTE, marginTop: 4}}>Reach your neighbors in their own language.</div>
      <div style={{...fadeIn(f, 24), marginTop: 44, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
        {items.map((t) => (
          <div key={t} style={{fontSize: 28, border: '1px solid #33443d', borderRadius: 12, padding: '12px 24px', color: ACCENT, textAlign: 'center'}}>{t}</div>
        ))}
      </div>
      <div style={{...fadeIn(f, 40), marginTop: 44, fontSize: 40, color: WARM, fontWeight: 600}}>neighborly-church.vercel.app</div>
      <div style={{...fadeIn(f, 48), marginTop: 18, fontSize: 24, color: MUTE}}>Grace Fellowship is a fictional sample church. Census data: ACS table C16001.</div>
    </AbsoluteFill>
  );
};

export const NeighborlyVideo: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: BG}}>
      {nsegs.map((s) => {
        const start = from;
        from += s.frames;
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.frames}>
            {s.layout === 'cap' ? <Pane seg={s} /> : s.layout === 'title' ? <Title /> : <End />}
            {s.label ? (
              <div style={{position: 'absolute', left: PANE.x, top: 20, fontFamily: font, fontSize: 28, fontWeight: 600, color: ACCENT}}>{s.label}</div>
            ) : null}
            {s.text ? <Audio src={staticFile(`neighborly/vo/${s.id}.wav`)} /> : null}
            {s.text ? <Captions text={s.text} frames={s.frames} /> : null}
          </Sequence>
        );
      })}
      <div style={{position: 'absolute', right: 60, top: 22, fontFamily: font, fontSize: 22, color: MUTE, textAlign: 'right'}}>Voice: synthetic (Piper TTS)</div>
      <Sequence from={nsegs[0].frames} durationInFrames={Math.ceil(9 * FPS)}>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 150, textAlign: 'center', fontFamily: font, fontSize: 24, color: INK}}>
          <span style={{background: 'rgba(0,0,0,.6)', padding: '6px 16px', borderRadius: 10}}>Real screen capture of the live app, recorded Nov 3, 2026. Grace Fellowship is sample data.</span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
