'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, Copy, DoorOpen, Eye, Flag, KeyRound, LockKeyhole, LogOut, Plus, RefreshCw, Send, ShieldCheck, Skull, Users, X, BookOpen, VolumeX, Check, QrCode } from 'lucide-react';
import type { RoomView } from '../lib/game';
import { ROLE_POOLS, roleRange, roleRule } from '../lib/role-rules';
import { MAX_NAME_LENGTH, nameLength } from '../lib/display-name';
import { DEFAULT_RULES, SPECIAL_NAMES, type Rules } from '../lib/custom-rules';
import CustomSettings from './custom-settings';
import PlayerRecords from './player-records';
import GamePreferences from './game-preferences';

type Summary = { id: string; title: string; count: number; status: string; locked: boolean; mine: boolean; owned: boolean; capacity: number };
type Dialog = 'create' | 'join' | 'rules' | 'share' | 'records' | null;
const labels = { treasure: '子豚', trap: '罠', empty: '空き部屋' };
const roleNames = { adventurer: '探検家', guardian: '豚男' };
async function api(body?: Record<string, unknown>, roomId?: string) {
  const response = await fetch('/api/game' + (roomId ? `?room=${encodeURIComponent(roomId)}` : ''), {
    method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => { throw new Error('サーバーとの接続が途切れました。少し待って同じ操作を再送してください'); }) as RoomView & { room: RoomView; rooms: Summary[]; roomId?: string; closed?: boolean; left?: boolean; error?: string };
  if (!response.ok) throw Object.assign(new Error(data.error || '通信に失敗しました'), { status: response.status });
  return data;
}
export default function GameClient({ signedIn }: { signedIn: boolean }) {
  const [ready,setReady]=useState(signedIn),[rules,setRules]=useState<Rules>({...DEFAULT_RULES}),[inspecting,setInspecting]=useState(false);
  const [rooms, setRooms] = useState<Summary[]>([]), [liveRoom, setRoom] = useState<RoomView | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null), [name, setName] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState('');
  const [spectate, setSpectate] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(signedIn), [online, setOnline] = useState(true);
  const [message, setMessage] = useState(''), [filter, setFilter] = useState('all');
  const [url, setUrl] = useState(''), [loginPath, setLoginPath] = useState('/signin-with-chatgpt?return_to=%2F');
  const roomRef = useRef<RoomView | null>(null), locked = useRef(false), initial = useRef(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const [presentation, setPresentation] = useState<{ roomId: string; frame: NonNullable<RoomView['lastReveal']>; until: number } | null>(null);
  const seenReveal = useRef('');
  const chatRef = useRef<HTMLDivElement>(null);
  const [roundAnnouncement, setRoundAnnouncement] = useState<number | null>(null);
  const accept = useCallback((next: RoomView) => {
    const previous = roomRef.current;
    if (previous?.id === next.id && previous.version > next.version) return;
    if (previous?.id !== next.id || previous?.gameNumber !== next.gameNumber || next.status === 'waiting') setPresentation(null);
    const frame = next.lastReveal;
    if (frame && frame.id !== seenReveal.current) {
      seenReveal.current = frame.id;
      const crossedRound = previous?.id === next.id && previous.gameNumber === next.gameNumber && previous.round < next.round;
      if ((frame.round < next.round || next.status === 'finished') && next.serverNow - frame.at < 10000 && (frame.until > next.serverNow || crossedRound)) {
        // サーバーで確定済みの状態を保持しつつ、最後の公開盤面だけを短く再生する。
        setPresentation({ roomId: next.id, frame, until: Date.now() + Math.max(2000, frame.until - next.serverNow) });
      }
    }
    roomRef.current = next; setRoom(next);
  }, []);
  const frame = presentation && liveRoom && presentation.roomId === liveRoom.id && presentation.frame.gameNumber === liveRoom.gameNumber ? presentation.frame : null;
  const room: RoomView | null = liveRoom && frame ? {
    ...liveRoom, status: 'playing', round: frame.round, flipped: frame.flipped,
    treasureFound: frame.treasureFound, trapTriggered: frame.trapTriggered, myCounts: frame.myCounts,
    players: liveRoom.players.map(p => ({ ...p, role: p.id === liveRoom.myId ? p.role : null, hand: frame.players.find(f => f.id === p.id)?.hand ?? p.hand })),
  } : liveRoom;
  useEffect(() => {
    if (!presentation) return;
    const timer = setTimeout(() => setPresentation(current => current?.frame.id === presentation.frame.id ? null : current), Math.max(0, presentation.until - Date.now()));
    return () => clearTimeout(timer);
  }, [presentation]);
  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    setRoundAnnouncement(room.round);
    const timer = setTimeout(() => setRoundAnnouncement(null), 1700);
    return () => clearTimeout(timer);
  }, [room?.id, room?.gameNumber, room?.round, room?.status]);
  const lastChatId = liveRoom?.chat.at(-1)?.id;
  useEffect(() => {
    const box = chatRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [liveRoom?.id, lastChatId]);
  const lobby = useCallback(() => {
    roomRef.current = null; setRoom(null); setPresentation(null); setRoundAnnouncement(null); setInspecting(false); setDialog(null); history.replaceState(null, '', '/'); setUrl(location.origin); setLoginPath('/signin-with-chatgpt?return_to=%2F'); setError(''); setNotice('');
  }, []);
  const enter = useCallback((next: RoomView) => {
    accept(next); setDialog(null); setPassword(''); history.replaceState(null, '', `/?room=${next.id}`); setUrl(location.href); setLoginPath('/signin-with-chatgpt?return_to='+encodeURIComponent('/?room='+next.id)); setNotice('');
  }, [accept]);
  const refresh = useCallback(async () => {
    if (!ready || document.hidden) return;
    const currentId = roomRef.current?.id;
    try {
      const data = await api(undefined, currentId);
      if (currentId && roomRef.current?.id === currentId) accept(data.room);
      else if (!currentId && !roomRef.current) setRooms(data.rooms);
      setOnline(true); setLoading(false);
    } catch (e: any) {
      setOnline(false); setLoading(false);
      if (e.status === 404 && currentId === roomRef.current?.id) { lobby(); setError(e.message); }
      else if (e.status === 401) { if(!signedIn)setReady(false); setError(signedIn?'ログインの有効期限が切れました。再ログインしてください':'ゲスト情報の有効期限が切れました。ゲストで開始してください'); }
    }
  }, [accept, lobby, ready, signedIn]);
  useEffect(() => {
    if (initial.current) return; initial.current = true;
    setUrl(location.href); setLoginPath('/signin-with-chatgpt?return_to=' + encodeURIComponent(location.pathname + location.search));
    try { setName(localStorage.getItem('pig-display-name') || ''); } catch {}
    const invited = new URLSearchParams(location.search).get('room');
    if(!signedIn){fetch('/api/game?session=1').then(r=>{if(r.ok){setReady(true);if(invited){setCode(invited.toUpperCase());api(undefined,invited.toUpperCase()).then(d=>enter(d.room)).catch(()=>setDialog('join'));}}}).catch(()=>{});return;}
    if (invited) {
      setCode(invited.toUpperCase());
      api(undefined, invited.toUpperCase()).then(d => enter(d.room)).catch((e: any) => {
        if (e.status === 403) setDialog('join'); else setError(e.message);
      }).finally(() => setLoading(false));
    }
    void refresh();
  }, [enter, refresh, signedIn]);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await refresh(); if (!stopped) timer = setTimeout(poll, roomRef.current?.status === 'playing' ? 1000 : roomRef.current ? 2000 : 5000); };
    timer = setTimeout(poll, 2000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [refresh]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(t); } }, [notice]);
  async function guestStart(){
    setBusy(true);setError('');try{await api({type:'guest'});setReady(true);const invited=new URLSearchParams(location.search).get('room');if(invited){setCode(invited.toUpperCase());setDialog('join');}else setDialog('join');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function send(body: Record<string, unknown>, retry = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const payload = retry ? pending.current! : { ...body, requestId: crypto.randomUUID() };
    pending.current = payload;
    try {
      const data = await api(payload);
      if (data.roomId) {
        try { const next = await api(undefined, data.roomId); enter(next.room); }
        catch (e: any) {
          // A creator can have left their still-open room. Rejoin explicitly.
          if (e.status === 403) { setCode(data.roomId); setDialog('join'); } else throw e;
        }
      } else if (data.closed || data.left) { lobby(); await refresh(); }
      else if (data.id) enter(data);
      if (payload.type === 'inspect') setInspecting(false);
      if (payload.type === 'chat') setMessage('');
      try { if (name.trim()) localStorage.setItem('pig-display-name', name.trim()); } catch {}
      pending.current = null; setOnline(true);
    } catch (e: any) {
      setError(e.message || '通信に失敗しました。同じ操作を再送できます');
      if (e.status) { pending.current = null; if (e.status === 409) await refresh(); }
    } finally { locked.current = false; setBusy(false); }
  }
  const act = (type: string, extra: Record<string, unknown> = {}) => send({ type, roomId: roomRef.current?.id, version: roomRef.current?.version, ...extra });
  const openJoin = (id = '', watching = false) => { setCode(id); setSpectate(watching); setPassword(''); setDialog('join'); setError(''); };
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setNotice('招待リンクをコピーしました'); }
    catch { setDialog('share'); }
  }
  const me = room?.players.find(p => p.id === room.myId), host = room?.hostId === room?.myId && !!room?.myId;
  const myTurn = !frame && room?.status === 'playing' && room?.myId === room?.keyHolderId;
  const keyHolder = room?.players.find(p => p.id === room.keyHolderId);
  const displayNameLength = nameLength(name);
  const validNameLength = displayNameLength >= 1 && displayNameLength <= MAX_NAME_LENGTH;
  const minPlayers=room?.rules.mode==='custom'?Math.max(3,room.rules.guardians+Math.max(1,Number(room.rules.appraiser)+Number(room.rules.keeper)),(room.rules.appraiser||room.rules.keeper)?5:3):3;
  const visibleRooms = rooms.filter(r => filter === 'all' || (filter === 'mine' ? r.mine : r.status === filter));
  return <div className="site-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="豚小屋探検隊 ロビー" onClick={e => {
        // Keep the mounted audio element alive on ordinary in-app navigation.
        // Modified clicks retain the browser's normal new-tab/window behavior.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); lobby(); void refresh(); window.scrollTo({ top: 0, behavior: 'auto' });
      }}><span className="brand-mark">豚</span><span>豚小屋探検隊<small>PIG HOUSE EXPLORATION TEAM</small></span></a>
      <nav><button className="nav-button" onClick={() => { lobby(); void refresh(); }}>ロビー</button><button className="nav-button" onClick={() => setDialog('rules')}><BookOpen size={15}/> 遊び方</button></nav>
      <div className="account">{signedIn ? <><span className="auth-label"><ShieldCheck size={15}/> ログイン済み</span><a className="icon-button" href="/signout-with-chatgpt?return_to=%2F" target="_top" aria-label="ログアウト"><LogOut size={17}/></a></> : <a className="login-small" href={loginPath} target="_top">ログイン <ArrowUpRight size={15}/></a>}</div>
    </header>
    <GamePreferences/><div className="records-entry">{ready&&<button className="text-button" onClick={()=>setDialog('records')}>戦績・ランキング</button>}{ready&&!signedIn&&<span>ゲスト利用中（一覧は参加中の部屋のみ） · <a href={loginPath}>ログインして戦績を引き継ぐ</a></span>}</div>
    {error && <div className="alert" role="alert"><span>{error}</span>{pending.current && <button onClick={() => void send({}, true)} disabled={busy}>同じ操作を再送</button>}{error.includes('再ログイン') && <a href={loginPath} target="_top">ログイン</a>}<button className="icon-button" onClick={() => setError('')} aria-label="エラーを閉じる"><X size={16}/></button></div>}
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}</div>}
    {!room ? <main className="lobby">
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> 仲間を信じる、正体隠匿カードゲーム</div><h1>扉の向こうに、<br/>仲間か、<em>罠か。</em></h1><p>子豚を救いたい探検家。行く手を阻む豚男。<br/>その一言を信じて、次の扉を開けられる？</p><div className="hero-meta"><span><Users size={16}/>3–10人</span><span><KeyRound size={16}/>最大4ラウンド</span><span>スマホ対応</span></div>
        <div className="hero-actions">{ready ? <button className="button primary" onClick={() => { setDialog('create'); setPassword(''); }}><Plus size={18}/>探検隊をつくる</button> : <button className="button primary" disabled={busy} onClick={guestStart}>ゲストで遊ぶ <ArrowUpRight size={18}/></button>}<button className="hero-secondary" onClick={() => setDialog('rules')}>はじめての方へ <ChevronRight size={16}/></button></div></div>
        <div className="hero-art"><img src="/images/title-banner.webp" alt="豚小屋探検隊 — 豚小屋に入らずんば子豚を得ず"/><span className="stamp">EXPLORATION<br/><b>No. 001</b></span></div>
      </section>
      <div className="lobby-columns"><section className="rooms-section"><div className="section-title"><div><span className="eyebrow dark">BASE CAMP</span><h2>探検隊ロビー <span className="count">{ready ? rooms.length : '—'}</span></h2></div><div className="section-actions"><button className="icon-button" onClick={() => void refresh()} disabled={!ready || loading} aria-label="ルーム一覧を更新"><RefreshCw size={17}/></button><button className="button outline small" disabled={!ready} onClick={() => openJoin()}>コードで参加 <ArrowUpRight size={15}/></button></div></div>
        <div className="filter-row">{[['all','すべて'],['waiting','募集中'],['playing','探検中'],['mine','参加中']].map(([v,l]) => <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>{l}</button>)}<span className="sync-status"><i className={online ? 'online' : 'offline'}/>{ready ? online ? '自動更新' : '再接続中' : 'ゲストでも参加OK'}</span></div>
        {!ready ? <div className="empty-state"><DoorOpen size={34}/><h3>探検の準備はできましたか？</h3><p>ゲストはニックネームと部屋コードで参加。ログインすると長期の戦績を保存できます。<br/>メールアドレスが他のプレイヤーに表示されることはありません。</p><a className="button dark-button" href={loginPath} target="_top">ログインしてロビーへ <ArrowUpRight size={16}/></a></div> : loading ? <div className="empty-state">探検隊を探しています…</div> : visibleRooms.length === 0 ? <div className="empty-state"><Flag size={34}/><h3>{filter === 'all' ? '最初の探検隊をつくろう' : '該当する探検隊はありません'}</h3><p>友だちに招待リンクを送って、3人集まったら出発。<br/>作成した部屋は、自動で保存されます。</p><button className="button dark-button" onClick={() => { setDialog('create'); setPassword(''); }}><Plus size={16}/>部屋をつくる</button></div> : <div className="room-list">{visibleRooms.map(r => <article className="room-row" key={r.id}><div className={'room-symbol ' + r.status}><DoorOpen size={23}/></div><div className="room-description"><span className={'status-tag ' + r.status}>{r.status === 'waiting' ? '仲間を募集中' : r.status === 'playing' ? '探検中' : '探検終了'}</span><h3>{r.title} {r.locked && <LockKeyhole size={14}/>}</h3><small>{r.id} · <Users size={12}/> {r.count} / {r.capacity}人</small></div><button className="button outline small" onClick={() => { if (r.mine) void api(undefined, r.id).then(d => enter(d.room)).catch(e => setError(e.message)); else openJoin(r.id, r.status !== 'waiting'); }}>{r.mine ? '部屋に戻る' : r.status === 'waiting' ? '参加する' : '観戦する'}<ChevronRight size={15}/></button></article>)}</div>}
        <p className="fine-print">切断しても席と手札はそのまま。最終操作から6時間で部屋は終了します。閲覧だけでは延長されません。</p>
      </section><aside className="field-guide"><span className="eyebrow dark">FIELD GUIDE / 01</span><h2>信じる相手を、<br/>間違えないように。</h2><div className="guide-cards"><img src="/images/adventurer.webp" alt="探検家の役職カード"/><img src="/images/pig-man.webp" alt="豚男の役職カード"/></div><p>探検家はすべての子豚を救出。<br/>豚男は罠と時間切れでそれを阻止。<br/>正体を隠して、言葉で導こう。</p><button className="text-button" onClick={() => setDialog('rules')}>探検のルールを読む <ArrowUpRight size={16}/></button><div className="guide-share"><QrCode size={20}/><span>友だちを探検に誘う</span><button className="icon-button" onClick={() => setDialog('share')} aria-label="招待QRコードを表示"><ArrowUpRight size={18}/></button></div></aside></div>
    </main> : <main className="game-main"><div className="room-header"><div><button className="breadcrumb" onClick={() => { lobby(); void refresh(); }}>← ロビーへ</button><h1>{room.title}</h1><div className="room-subtitle"><span>{room.id}</span><span><Users size={14}/>{room.players.length}人</span><span><Eye size={14}/>{room.spectatorCount}人</span><span className="sync-status"><i className={online ? 'online' : 'offline'}/>{online ? '同期中' : '再接続中'}</span></div></div><div className="section-actions"><button className="button outline small" onClick={copyLink}><Copy size={15}/>招待リンク</button><button className="icon-button" onClick={() => setDialog('rules')} aria-label="遊び方"><BookOpen size={20}/></button></div></div>
      {room.status === 'waiting' ? <section className="waiting-panel"><div className="eyebrow">READY FOR EXPLORATION</div><h2>仲間が集まったら、出発。</h2><p>{room.rules.mode==='custom'?`カスタム · 定員${room.rules.capacity} · 豚男${room.rules.guardians} · 罠${room.rules.traps} · ${(['appraiser','keeper'] as const).filter(k=>room.rules[k]).map(k=>SPECIAL_NAMES[k]).join('・')||'特殊役職なし'}`:'標準ルール · 公式ランキング対象'}</p><p>3〜10人で遊べます。招待リンクを送って探検隊を集めましょう。</p>{room.players.length >= 3 && <button className="role-hint" onClick={() => setDialog('rules')}>この人数の豚男：{room.rules.mode==='custom'?room.rules.guardians+'人':roleRange(room.players.length)} · 配役表を見る <BookOpen size={14}/></button>}<div className="seats">{room.players.map((p,i) => <div className="seat" key={p.id}><span>{String(i+1).padStart(2,'0')}</span><strong>{p.name}</strong><small>{p.id === room.hostId ? 'ホスト' : p.id === room.myId ? 'あなた' : '参加済み'}</small></div>)}{Array.from({length: Math.max(0,minPlayers-room.players.length)},(_,i) => <div className="seat vacant" key={i}><Plus size={24}/><small>仲間を待っています</small></div>)}</div><div className="waiting-actions">{host ? <button className="button primary" disabled={busy || room.players.length < minPlayers} onClick={() => act('start')}><Flag size={17}/>{room.players.length < minPlayers ? `あと${minPlayers-room.players.length}人で出発` : '探検をはじめる'}</button> : <p>{room.spectator ? '観戦席から待機しています' : 'ホストの開始を待っています'}</p>}{room.spectator && <button className="button outline" disabled={busy || room.players.length >= room.rules.capacity} onClick={() => act('join',{name})}>プレイヤーとして参加</button>}</div></section> : <>
        <div className="scoreboard"><div><span>ROUND</span><strong>{room.round}<small> / 4</small></strong></div><div><span>救出した子豚</span><strong className="rescue">{room.treasureFound}<small> / {room.treasureGoal}</small></strong></div><div><span>発動した罠</span><strong className="danger">{room.trapTriggered}<small> / {room.trapGoal}</small></strong></div><div><span>このラウンド</span><strong>{room.flipped}<small> / {room.players.length}枚</small></strong></div></div>
        {room.status === 'finished' ? <section className="outcome"><Flag size={30}/><h2>{room.winner === 'adventurer' ? '探検家チームの勝利！' : '豚男チームの勝利！'}</h2><p>{room.winner === 'adventurer' ? 'すべての子豚を救出しました。お見事！' : room.trapTriggered >= room.trapGoal ? 'すべての罠が発動しました。' : '4ラウンドが終了しました。'}</p>{host && <div className="section-actions"><button className="button primary" disabled={busy} onClick={() => act('restart')}>もう一度遊ぶ</button><button className="button outline" disabled={busy} onClick={() => act('reset')}>待機室へ戻す</button></div>}</section> : <div className={'turn-banner ' + (myTurn ? 'your-turn' : '')}><KeyRound size={22}/><div><strong>{myTurn ? 'あなたが鍵を持っています' : `${keyHolder?.name}が鍵を持っています`}</strong><p>{myTurn ? 'ほかの隊員の伏せられたカードを1枚選んでください。' : room.spectator ? '観戦中 · 役職と未公開カードは表示されません。' : '会話しながら、次に開く部屋を相談しましょう。'}</p></div></div>}
        {me?.role && <div className="private-role"><img src={`/images/${me.role === 'guardian' ? 'pig-man' : 'adventurer'}.webp`} alt=""/><div><small>あなただけの役職</small><strong>{me.special?SPECIAL_NAMES[me.special]:roleNames[me.role]}</strong><p>{me.role === 'adventurer' ? '子豚をすべて見つけ、救出しよう。' : '探検家を罠へ導き、救出を阻もう。'}</p></div></div>}
        {room.myCounts && <div className="hand-summary"><span>あなたの未公開カード</span><strong>子豚 {room.myCounts.treasure}枚</strong><strong>罠 {room.myCounts.trap}枚</strong><span>空き部屋 {room.myCounts.empty}枚</span><small>通常の手札表示では並び順は秘密です</small></div>}
        <button className="role-hint dark-hint" onClick={() => setDialog('rules')}>{room.legacyRoles ? '更新前の配役で進行中 · 新ルールは次の探検から' : `この人数の豚男：${room.rules.mode==='custom'?room.rules.guardians+'人':roleRange(room.players.length)} · ${room.status === 'finished' ? '配役を公開しました' : '正体は終局まで秘密'}`} <BookOpen size={14}/></button>
        {room.myIntel&&<div className="special-panel"><strong>あなただけの調査結果</strong><p>ラウンド{room.myIntel.round} · {room.players.find(p=>p.id===room.myIntel!.targetId)?.name}：{room.myIntel.cardType?`${Number(room.myIntel.cardId?.split(':')[2])+1}枚目は${labels[room.myIntel.cardType]}`:room.myIntel.faction?roleNames[room.myIntel.faction]:''}</p><small>当時の情報です。ラウンドが変わるとカード位置は変わります。結果は他の人には送信されません。</small></div>}
        {me?.special==='appraiser'&&room.status==='playing'&&!me.abilityUsed&&<div className="special-panel"><button className="button outline" disabled={busy||!!frame} onClick={()=>setInspecting(!inspecting)}>{inspecting?'鑑定を取り消す':'1回だけ秘密に鑑定する'}</button>{inspecting&&<p>他の隊員の未公開カードを選択してください。公開せず、鍵も移動しません。</p>}</div>}
        {frame && <div className="reveal-pause" role="status">最後に開いた部屋を確認中…{liveRoom?.status === 'finished' ? 'まもなく結果発表' : 'まもなく次のラウンド'}</div>}
        <section className="board" aria-label="ゲーム盤面">{room.players.map(p => <article key={p.id} className={'player-board ' + (p.id === room.keyHolderId && room.status === 'playing' ? 'has-key' : '')}><div className="player-heading"><h3>{p.id === room.keyHolderId && <KeyRound size={17}/>} {p.name}{p.id === room.myId && <small>あなた</small>}</h3>{p.role && <span className={'role-tag ' + p.role}>{p.special?SPECIAL_NAMES[p.special]:roleNames[p.role]}</span>}</div><div className="hand">{p.hand.map((card,index) => {
          const canInspect=inspecting&&me?.special==='appraiser'&&!me.abilityUsed&&room.status==='playing'&&!frame;
          const canOpen = (myTurn || canInspect) && p.id !== room.myId && !card.revealed && !busy && online;
          return <GameCard key={card.id} card={card} name={p.name} index={index} canOpen={canOpen} onOpen={() => void act(canInspect?'inspect':'reveal',{targetId:p.id,cardId:card.id})}/>;
        })}</div></article>)}</section>
      </>}
      <div className="room-bottom"><section className="conversation"><h2>探検隊チャット <span>TALK TO YOUR TEAM</span></h2><p className="chat-note">各ラウンド最新100件 · 再戦・待機室へ戻すと消去</p><div className="chat-messages" ref={chatRef} role="log" aria-label="探検隊の会話" tabIndex={0} aria-live="polite">{room.chat.length ? room.chat.map((m, i) => <Fragment key={m.id}>{m.kind === 'round' ? <div className="chat-divider">ラウンド {m.round}</div> : <>{(i === 0 || room.chat[i-1].round !== m.round) && <div className="chat-divider">{m.round === undefined ? '更新前の会話' : m.round === 0 ? 'ベースキャンプ' : `ラウンド ${m.round}`}</div>}<div className="chat-message"><strong>{m.name}</strong><p>{m.text}</p></div></>}</Fragment>) : <p className="muted">{liveRoom?.status === 'finished' ? '探検終了。ここで感想を話しましょう。' : '「子豚が2匹いるよ」その言葉を信じる？ここで仲間と相談できます。'}</p>}</div><form onSubmit={e => { e.preventDefault(); void act('chat',{message}); }}><input aria-label="チャットメッセージ" placeholder="仲間に話しかける…" maxLength={300} value={message} onChange={e => setMessage(e.target.value)}/><button className="button dark-button" disabled={busy || !message.trim()} aria-label="メッセージを送信"><Send size={17}/></button></form></section><section className="exploration-log"><h2>探検の記録 <span>EXPEDITION LOG</span></h2><ol>{[...room.logs].reverse().map(m => <li key={m.id}>{m.text}</li>)}</ol>{!room.logs.length && <p className="muted">まだ探検は始まっていません。</p>}</section></div>
      <div className="room-controls"><p>最終操作から6時間、席を保存します。ゲストは同じブラウザ、ログイン利用者は同じアカウントで復帰できます。</p>{room.status !== 'playing' || room.spectator ? <button className="text-button" disabled={busy} onClick={() => { if (confirm('この部屋から退室しますか？')) void act('leave'); }}>退室する</button> : null}{host && <button className="text-button danger" disabled={busy} onClick={() => { if (confirm('部屋を閉じると、全員の探検とチャットが削除されます。閉じますか？')) void act('close'); }}>部屋を閉じる</button>}</div>
    </main>}
    <footer><span>豚小屋探検隊 <small>v0.4.2 · © PIG HOUSE EXPLORATION TEAM</small></span><span><VolumeX size={14}/>BGMは画面上部からON / OFF</span><button onClick={() => setDialog('share')}>友だちを招待 <ArrowUpRight size={14}/></button></footer>
    {roundAnnouncement && room?.status === 'playing' && <div className="round-announcement" key={`${room.id}:${room.gameNumber}:${roundAnnouncement}`} role="status"><span>EXPLORATION CONTINUES</span><strong>ROUND {roundAnnouncement}</strong><small>{6-roundAnnouncement}枚の扉、新しい駆け引き。</small></div>}
    {dialog && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setDialog(null); }}><section className={'modal ' + (dialog === 'rules' ? 'rules-modal' : '')} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="modal-close icon-button" disabled={busy} onClick={() => setDialog(null)} aria-label="閉じる"><X size={22}/></button>
      {dialog === 'create' || dialog === 'join' ? <><span className="eyebrow dark">{dialog === 'create' ? 'NEW EXPEDITION' : 'JOIN THE TEAM'}</span><h2 id="dialog-title">{dialog === 'create' ? '探検隊をつくる' : '探検隊に参加する'}</h2><p>ゲーム内で使う名前を決めましょう。</p><form onSubmit={e => { e.preventDefault(); if (ready && validNameLength) void send(dialog === 'create' ? {type:'create',name,password,rules} : {type:spectate?'spectate':'join',name,password,roomId:code.trim().toUpperCase()}); }}><label>表示名 <small>1〜8文字</small><input autoFocus required maxLength={64} aria-label="表示名" aria-describedby="name-length" aria-invalid={displayNameLength > MAX_NAME_LENGTH} value={name} placeholder="例：ぶた太郎" onChange={e => setName(e.target.value)}/><span id="name-length" className={displayNameLength > MAX_NAME_LENGTH ? 'name-counter invalid' : 'name-counter'} aria-live="polite">{displayNameLength} / {MAX_NAME_LENGTH}文字{displayNameLength > MAX_NAME_LENGTH ? ' · 8文字以内に短くしてください' : ''}</span></label>{dialog === 'create' && <CustomSettings value={rules} onChange={setRules}/>}
{dialog === 'join' && <label>部屋コード<input required value={code} maxLength={8} placeholder="8文字の部屋コード" autoCapitalize="characters" onChange={e => setCode(e.target.value.toUpperCase())}/></label>}<label>合言葉 <small>{dialog === 'create' ? '任意 · 設定すると参加時に必要です' : '設定された部屋のみ'}</small><input type="password" autoComplete="off" minLength={password ? 4 : undefined} maxLength={64} value={password} onChange={e => setPassword(e.target.value)} placeholder="合言葉なしでも遊べます"/></label>{dialog === 'join' && <label className="checkbox-label"><input type="checkbox" checked={spectate} onChange={e => setSpectate(e.target.checked)}/>観戦者として参加する</label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={busy || !ready || !validNameLength}>{busy ? '準備しています…' : dialog === 'create' ? '部屋をつくる' : spectate ? '観戦する' : '参加する'}<ArrowUpRight size={17}/></button><p className="fine-print">表示名は他の参加者に公開されます。個人情報を含めないでください。</p></form></> : dialog === 'records' ? <><h2 id="dialog-title">探検家の手帳</h2><PlayerRecords signedIn={signedIn}/></> : dialog === 'rules' ? <><span className="eyebrow dark">EXPLORER'S HANDBOOK</span><h2 id="dialog-title">豚小屋探検の心得</h2><p className="rules-lead">仲間を信じて子豚を救出する、3〜10人の正体隠匿ゲーム。</p><div className="team-rules"><div><img src="/images/adventurer.webp" alt="探検家"/><h3>探検家</h3><p>すべての子豚を救出すれば勝利。</p></div><div><img src="/images/pig-man.webp" alt="豚男"/><h3>豚男</h3><p>すべての罠が発動、または4ラウンド終了で勝利。</p></div></div><ol className="rules-steps"><li><strong>自分の役職と手札の枚数を確認</strong><p>役職と手札の内訳は自分だけに見えます。カードの並び順は自分にも秘密。枚数について嘘をつくのも作戦です。</p></li><li><strong>鍵を持つ人が、他の人のカードを1枚開く</strong><p>自分のカードは選べません。開かれた部屋の持ち主に鍵が移ります。</p></li><li><strong>人数分のカードを開いたら、次のラウンドへ</strong><p>未公開カードだけを回収・再配布。手札は5→4→3→2枚。救出数と罠の数は持ち越します。</p></li><li><strong>相談しながら、4ラウンド以内に救出</strong><p>3〜6人では人数＋2匹、7〜10人では人数と同じ数の子豚。罠は2個（10人時は3個）です。</p></li></ol><div className="role-table-wrap"><h3>人数別の役職カード</h3><p>下のカードをシャッフルして1人1枚ずつ配ります。余ったカードは誰にも見せません。豚男同士も正体を知りません。</p><table className="role-table"><thead><tr><th>参加</th><th>探検家</th><th>豚男</th><th>余り</th><th>参加者の豚男</th></tr></thead><tbody>{ROLE_POOLS.map(pool => <tr key={pool.players} className={room?.players.length === pool.players ? 'current' : ''}><td>{pool.players}人</td><td>{pool.adventurers}枚</td><td>{pool.guardians}枚</td><td>{roleRule(pool.players)!.spare}枚</td><td>{roleRange(pool.players)}</td></tr>)}</tbody></table><p>実際の配役は終局時に公開されます。役職を会話で明かすかは自由です。</p></div><div className="special-panel"><h3>カスタムの特殊役職</h3><p>豚小屋鑑定士：他者の未公開カードを試合中1回だけ秘密に確認。古参の飼育係：開始時に他者1名の陣営を秘密に知ります。調査役は5人以上用です。調査を受けた人にも通知されません。誰でも会話で役職を名乗れるので対抗は自由です。</p><p>カスタム戦は公式ランキング対象外です。</p></div><div className="rules-note"><ShieldCheck size={20}/><p>観戦者に未公開カードと役職は見えません。切断しても席と手札を保存します。鍵を持つ人が不在なら復帰を待つか、ホストが部屋を閉じて作り直してください。</p></div></> : <><span className="eyebrow dark">INVITE YOUR FRIENDS</span><h2 id="dialog-title">一緒に、探検しよう。</h2><p>{room ? 'この部屋の招待リンクです。ゲストでも参加できます。' : 'QRコードからロビーへ。ゲストでも参加できます。'}</p>{!room && <img className="qr-image" src="/invite-qr.png" alt="豚小屋探検隊のロビーを開くQRコード"/>}<label>招待リンク<input readOnly value={url} onFocus={e => e.target.select()}/></label><button className="button primary full" onClick={copyLink}><Copy size={16}/>リンクをコピー</button>{!room && <a className="text-button" href="/invite-qr.png" download="pig-house-qr.png">QR画像を保存 <ArrowUpRight size={15}/></a>}</>}
    </section></div>}
  </div>;
}

function GameCard({ card, name, index, canOpen, onOpen }: { card: RoomView['players'][number]['hand'][number]; name: string; index: number; canOpen: boolean; onOpen: () => void }) {
  const wasRevealed = useRef(card.revealed);
  const [flipping, setFlipping] = useState(false);
  useEffect(() => {
    if (!wasRevealed.current && card.revealed) setFlipping(true);
    wasRevealed.current = card.revealed;
  }, [card.revealed]);
  const type = card.type;
  return <button className={'card ' + (type ? 'face' : 'back') + (card.revealed ? ' revealed' : '') + (flipping ? ' flipping' : '')} onAnimationEnd={() => setFlipping(false)} disabled={!canOpen} aria-label={`${name}の${index+1}枚目：${type ? labels[type] : '未公開'}${card.revealed ? '（公開済み）' : ''}`} onClick={onOpen}>{type ? <><img src={`/images/${type}-medium.webp`} alt={labels[type]}/><span>{labels[type]}</span></> : <><div className="door-lines"><KeyRound size={20}/></div><span>{String(index+1).padStart(2,'0')}</span></>}{card.revealed && <small className="opened">公開済</small>}</button>;
}
