'use client';
import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX, Minus, Plus } from 'lucide-react';

const SIZES = [0.9, 1, 1.15, 1.3];
const SIZE_LABELS = ['小', '標準', '大', '特大'];
export default function GamePreferences() {
  const [size, setSize] = useState(1), [volume, setVolume] = useState(25);
  const [enabled, setEnabled] = useState(false), [playing, setPlaying] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  const graph = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const wanted = useRef(false), level = useRef(25), attempt = useRef(0);
  const startRef = useRef<() => Promise<void>>(async () => {});

  function changeSize(next: number) {
    setSize(next); document.documentElement.style.setProperty('--text-scale', String(SIZES[next]));
    try { localStorage.setItem('pig-text-size', String(next)); } catch {}
  }
  function changeVolume(next: number) {
    setVolume(next); level.current = next;
    if (graph.current) graph.current.gain.gain.setTargetAtTime(next / 100, graph.current.context.currentTime, 0.08);
    try { localStorage.setItem('pig-bgm-volume', String(next)); } catch {}
  }
  async function start() {
    const player = audio.current;
    if (!player || !wanted.current || document.hidden) return;
    const id = ++attempt.current;
    setLoading(true); setError('');
    try {
      if (!graph.current) {
        const context = new AudioContext(), gain = context.createGain();
        gain.gain.value = level.current / 100;
        context.createMediaElementSource(player).connect(gain).connect(context.destination);
        graph.current = { context, gain };
      }
      await graph.current.context.resume();
      if (id !== attempt.current || !wanted.current || document.hidden) return;
      await player.play();
    } catch {
      if (id === attempt.current && wanted.current) {
        wanted.current = false; setEnabled(false);
        setError('BGMを再生できませんでした。もう一度BGMボタンを押してください。');
      }
    } finally { if (id === attempt.current) setLoading(false); }
  }
  startRef.current = start;
  function toggle() {
    wanted.current = !wanted.current; setEnabled(wanted.current); setError('');
    if (wanted.current) void start();
    else {
      attempt.current++; setLoading(false); audio.current?.pause();
      void graph.current?.context.suspend().catch(() => {});
    }
  }
  useEffect(() => {
    try {
      const savedSize = localStorage.getItem('pig-text-size'), savedVolume = localStorage.getItem('pig-bgm-volume');
      const s = Number(savedSize), v = Number(savedVolume);
      if (savedSize !== null && Number.isInteger(s) && s >= 0 && s < SIZES.length) changeSize(s);
      if (savedVolume !== null && Number.isFinite(v) && v >= 0 && v <= 100) changeVolume(v);
    } catch {}
    const visibility = () => {
      if (document.hidden) {
        attempt.current++; setLoading(false); audio.current?.pause();
        void graph.current?.context.suspend().catch(() => {});
      } else if (wanted.current) void startRef.current();
    };
    document.addEventListener('visibilitychange', visibility);
    const player = audio.current;
    return () => { document.removeEventListener('visibilitychange', visibility); wanted.current = false; attempt.current++; player?.pause(); void graph.current?.context.close().catch(() => {}); graph.current = null; };
  }, []);

  return <section className="preferences-bar" aria-label="音楽と文字サイズの設定">
    <div className="music-controls">
      <button className={'preference-button music-toggle ' + (enabled ? 'active' : '')} onClick={toggle} aria-pressed={enabled} aria-label={enabled ? 'BGMを止める' : 'BGMを再生'}>{playing ? <Volume2 size={16}/> : enabled ? <Music2 size={16}/> : <VolumeX size={16}/>}<span>{loading ? '読み込み中…' : playing ? 'BGM 再生中' : enabled ? 'BGM 一時停止' : 'BGM OFF'}</span></button>
      <label className="volume-control"><span>音量</span><input type="range" aria-label="BGMの音量" min="0" max="100" step="5" value={volume} onChange={e => changeVolume(Number(e.target.value))}/><output>{volume}%</output></label>
      <span className="music-caption">影の豚小屋</span>
    </div>
    <div className="text-controls" role="group" aria-label="文字サイズ">
      <span>文字</span><button className="preference-button" aria-label="文字を小さく" disabled={size === 0} onClick={() => changeSize(size-1)}><Minus size={14}/><span>A</span></button>
      <button className="preference-button size-reset" aria-label="文字サイズを標準に戻す" onClick={() => changeSize(1)}>{SIZE_LABELS[size]}</button>
      <button className="preference-button" aria-label="文字を大きく" disabled={size === SIZES.length-1} onClick={() => changeSize(size+1)}><span>A</span><Plus size={14}/></button>
      <output className="sr-only" aria-live="polite">文字サイズ {SIZE_LABELS[size]}</output>
    </div>
    {error && <p className="music-error" role="status">{error}</p>}
    <audio ref={audio} src="/audio/shadows-in-the-barn.mp3" loop preload="none" playsInline onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { wanted.current = false; attempt.current++; setEnabled(false); setPlaying(false); setLoading(false); setError('BGMを読み込めませんでした。ゲームはそのまま遊べます。'); }}/>
  </section>;
}
