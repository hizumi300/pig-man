// Original instrumental: "影の豚小屋 / Shadows in the Barn".
// Deterministic synthesis only: no samples, external music, or network calls.
// Requires the already-installed ffmpeg to encode a small, gapless-tagged MP3.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const rate = 44100, beat = 60 / 76, bars = 16, duration = bars * 4 * beat;
const length = Math.round(duration * rate), left = new Float64Array(length), right = new Float64Array(length);
const tau = Math.PI * 2, hz = midi => 440 * 2 ** ((midi - 69) / 12);
function note(midi, startBeat, beats, amp, kind, pan = 0) {
  const freq = hz(midi), seconds = beats * beat, count = Math.round((seconds + (kind === 'bell' ? 2.3 : 0.5)) * rate);
  const start = Math.round(startBeat * beat * rate), l = Math.sqrt((1-pan)/2), r = Math.sqrt((1+pan)/2);
  for(let j=0;j<count;j++) {
    const t=j/rate;
    let sample;
    if(kind==='pad') {
      const env=Math.min(1,t/0.9)*Math.min(1,Math.max(0,(seconds+0.5-t)/1.2));
      sample=env*(Math.sin(tau*freq*t)*0.62+Math.sin(tau*freq*1.003*t)*0.23+Math.sin(tau*freq*2*t)*0.1+Math.sin(tau*freq*3*t)*0.05)*(0.9+0.1*Math.sin(tau*0.17*t));
    } else if(kind==='bell') {
      sample=(1-Math.exp(-t*100))*Math.exp(-t/1.15)*(Math.sin(tau*freq*t)+0.24*Math.sin(tau*freq*2.01*t)*Math.exp(-t*2)+0.07*Math.sin(tau*freq*3.98*t)*Math.exp(-t*3));
    } else {
      sample=Math.min(1,t/0.025)*Math.exp(-t/(seconds*0.45))*(Math.sin(tau*freq*t)+0.12*Math.sin(tau*freq*2*t));
    }
    const value=sample*amp, index=(start+j)%length;
    left[index]+=value*l; right[index]+=value*r;
    // Dark, diffuse echoes, circular so the decay continues across the loop seam.
    for(const [delay,decay] of [[0.19,0.16],[0.37,0.1],[0.61,0.06]]) {
      const k=(index+Math.round(delay*rate))%length;
      left[k]+=value*r*decay;right[k]+=value*l*decay;
    }
  }
}
// Dm(add9) → Bbmaj7 → Gm(add9) → Am; a restrained, unresolved night-time loop.
const chords=[[38,45,53,64],[34,41,50,57],[31,38,46,57],[33,40,48,59]];
const melody=[[74,0,1],[69,1.5,0.7],[65,3,1],[72,5.5,1],[69,7,1],[70,8.5,1],[65,11,1],[62,13,1.4],[69,16,1],[67,18,1],[62,20.5,1],[65,23,1],[64,25,1.5],[69,27.5,1],[61,29,0.8],[64,31,1]];
for(let bar=0;bar<bars;bar++){
  const chord=chords[Math.floor(bar/2)%4];
  if(bar%2===0) chord.forEach((m,i)=>note(m,bar*4,8, i===0?0.11:0.045,'pad',(i-1.5)*0.38));
  note(chord[0]-12,bar*4,1.8,0.16,'bass');
  if(bar%2===1)note(chord[0]-12,bar*4+2.5,0.8,0.07,'bass');
  [0.5,2,3.5].forEach((offset,i)=>note(chord[1+i%3]+12,bar*4+offset,0.5,0.022,'bell',i%2===0?-0.6:0.6));
}
for(const [m,b,d] of melody) { note(m,b,d,0.07,'bell',-0.18); note(m,b+32,d,0.06,'bell',0.18); }
const peak=Math.max(...[left,right].map(channel=>channel.reduce((m,s)=>Math.max(m,Math.abs(s)),0)));
// Quiet master with headroom. Initial player gain is another 25%.
const gain=0.48/peak, pcm=Buffer.alloc(length*4);
let square=0;
for(let i=0;i<length;i++){
  const seam=Math.min(1,i/(rate*0.006),(length-1-i)/(rate*0.006));
  for(const [channel,offset] of [[left,0],[right,2]]){const sample=channel[i]*gain*seam;square+=sample*sample;pcm.writeInt16LE(Math.round(sample*32767),i*4+offset);}
}
const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(pcm.length+36,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
await mkdir('outputs',{recursive:true});await mkdir('public/audio',{recursive:true});
const temporary='outputs/shadows-in-the-barn.wav';await writeFile(temporary,Buffer.concat([wav,pcm]));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',temporary,'-codec:a','libmp3lame','-b:a','112k','-map_metadata','-1','-metadata','title=影の豚小屋','public/audio/shadows-in-the-barn.mp3']);
await rm(temporary);
console.log(JSON.stringify({durationSeconds:duration,bpm:76,peak:0.48,rms:Math.sqrt(square/(length*2)),channels:2,source:'original synthesis'}));
