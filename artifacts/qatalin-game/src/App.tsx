import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Crosshair, Eye, FileWarning, Flag, RotateCcw, Shield, Skull, Target, UserRound, UsersRound } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import referenceArtwork from '@assets/fd10b1bd-72e2-44f2-b5e9-1b6a71042db5_1786524671090.jpg';

type Screen = 'intro' | 'room' | 'teams' | 'game';
type Phase = 'question' | 'target' | 'reveal' | 'ending';
type Footballer = { name: string; isBoss: boolean; status: 'active' | 'excluded' | 'assassinated'; revealed: boolean };
type Team = { owner: string; footballers: Footballer[] };
type HistoryItem = { round: number; attacker: string; target: string; action: 'exclude' | 'assassinate' };
type GameState = { version: 2; screen: Screen; phase: Phase; playerCount: number; owners: string[]; teams: Team[]; setupIndex: number; round: number; turn: number; targetTeam: number | null; targetPlayer: number | null; notes: string; winner: number | null; history: HistoryItem[] };

const queryClient = new QueryClient();
const STORAGE_KEY = 'qatalin-football-gangs-v2';
const ownerDefaults = ['أحمد', 'محمد', 'كريم', 'عمر', 'يوسف', 'زياد'];
const footballDefaults = ['محمد صلاح', 'ليونيل ميسي', 'كريستيانو رونالدو', 'كيليان مبابي', 'إيرلينغ هالاند', 'لوكا مودريتش', 'كيفن دي بروين', 'فينيسيوس جونيور', 'جود بيلينغهام', 'رودري'];
const questions = [
  'أي لاعب في فريق خصمك يحاول توجيه الشك بعيداً عنه؟ ولماذا؟',
  'لو كان عليك كشف لاعب واحد الآن، من تختار وما دليلك؟',
  'أي إجابة بدت محسوبة أكثر من اللازم في الجولة السابقة؟',
  'من تتوقع أنه يحمي زعيم العصابة دون أن يقصد؟',
  'ما الحركة التي فضحت ترتيب القوة داخل فريق الخصم؟',
  'من اللاعب الذي تغيّر أسلوب دفاعه عندما اقترب الاتهام منه؟',
];

const emptyFootballers = () => footballDefaults.map((name) => ({ name, isBoss: false, status: 'active' as const, revealed: false }));
const initialState = (): GameState => ({ version: 2, screen: 'intro', phase: 'question', playerCount: 2, owners: ownerDefaults.slice(0, 2), teams: [], setupIndex: 0, round: 1, turn: 0, targetTeam: null, targetPlayer: null, notes: '', winner: null, history: [] });
function readSavedGame(): GameState { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'); return saved?.version === 2 ? saved : initialState(); } catch { return initialState(); } }

function App() {
  const [game, setGame] = useState<GameState>(readSavedGame);
  const [draft, setDraft] = useState<Footballer[]>(emptyFootballers);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }, [game]);
  const update = (changes: Partial<GameState>) => setGame((current) => ({ ...current, ...changes }));
  const setCount = (count: number) => update({ playerCount: count, owners: Array.from({ length: count }, (_, i) => game.owners[i] ?? ownerDefaults[i] ?? `لاعب ${i + 1}`) });
  const beginTeams = () => update({ screen: 'teams', setupIndex: 0, teams: [] });
  const saveTeam = () => {
    const cleaned = draft.map((player, index) => ({ ...player, name: player.name.trim() || `لاعب كرة ${index + 1}` }));
    const teams = [...game.teams, { owner: game.owners[game.setupIndex], footballers: cleaned }];
    if (game.setupIndex === game.playerCount - 1) setGame({ ...game, screen: 'game', phase: 'question', teams, setupIndex: 0, round: 1, turn: 0, targetTeam: null, targetPlayer: null, winner: null, history: [] });
    else { update({ teams, setupIndex: game.setupIndex + 1 }); setDraft(emptyFootballers()); }
  };
  const reset = () => { if (window.confirm('هل تريد بدء غرفة جديدة؟')) { window.localStorage.removeItem(STORAGE_KEY); setGame(initialState()); setDraft(emptyFootballers()); } };
  return <div className="game-shell" dir="rtl"><div className="frame">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Crosshair size={19} /></div><div><span className="brand-name">عصابة الملاعب</span><span className="brand-sub">ملف الزعماء السري</span></div></div><button className="utility-button" onClick={() => setShowRules(true)}><FileWarning size={15} /> قواعد اللعبة</button></header>
    <AnimatePresence mode="wait">
      {game.screen === 'intro' && <IntroView onStart={() => update({ screen: 'room' })} onRules={() => setShowRules(true)} />}
      {game.screen === 'room' && <RoomSetup game={game} setCount={setCount} update={update} onBack={() => update({ screen: 'intro' })} onContinue={beginTeams} />}
      {game.screen === 'teams' && <TeamSetup game={game} draft={draft} setDraft={setDraft} onSave={saveTeam} onBack={() => game.setupIndex === 0 ? update({ screen: 'room' }) : undefined} />}
      {game.screen === 'game' && <GameView game={game} setGame={setGame} onReset={reset} />}
    </AnimatePresence>
    <footer className="footer-note">عصابة الملاعب — اكشف الزعيم قبل أن يختفي الدليل</footer>
  </div>{showRules && <RulesModal onClose={() => setShowRules(false)} />}</div>;
}

function IntroView({ onStart, onRules }: { onStart: () => void; onRules: () => void }) {
  return <motion.main className="intro-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><section className="hero"><div className="hero-copy"><div className="eyebrow">مواجهة فرق — سري للغاية</div><h1 className="hero-title">عصابة<em>الملاعب</em></h1><p className="hero-lede">كل لاعب يبني فريقاً من 10 نجوم كرة قدم ويخفي بينهم زعيمين للعصابة. اسأل، راقب، ثم اكشف فريق خصمك واستبعد رجاله أو اغتل زعماءه.</p><div className="hero-actions"><button className="primary-button" onClick={onStart}>أنشئ الغرفة <ArrowLeft size={17} /></button><button className="ghost-button" onClick={onRules}>كيف نلعب؟ <CircleHelp size={17} /></button></div><div className="hero-note"><UsersRound size={14} /> من 2 إلى 6 لاعبين حقيقيين · 10 نجوم لكل فريق</div></div><div className="hero-art"><img src={referenceArtwork} alt="ملف عصابة الملاعب الفني" /><div className="art-stamp">تشكيلة سرية / ممنوع الكشف</div></div></section><section className="intro-rules"><div className="eyebrow">خطة المواجهة</div><h2 className="section-title">كوّن فريقك. أخفِ زعماءك.</h2><div className="rules-grid">{[['01','ابنِ التشكيلة','سمّ 10 لاعبي كرة في فريقك وحدد اثنين فقط كزعيمي العصابة.'],['02','حقق مع الخصم','في دورك ناقش سؤال الجولة ثم اختر لاعباً من فريق خصمك لكشفه.'],['03','احسم المصير','استبعد اللاعب العادي، وإذا اكتشفت زعيماً افتح أمر الاغتيال.']].map(([n,t,b]) => <article className="rule-card" key={n}><div className="rule-number">{n}</div><h3>{t}</h3><p>{b}</p></article>)}</div></section></motion.main>;
}

function RoomSetup({ game, setCount, update, onBack, onContinue }: { game: GameState; setCount: (n:number)=>void; update:(c:Partial<GameState>)=>void; onBack:()=>void; onContinue:()=>void }) {
  return <motion.main className="setup-wrap" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}><div className="eyebrow">الخطوة الأولى</div><div className="game-header"><h1>من في الغرفة؟</h1><div className="round-marker"><strong>{game.playerCount}</strong> لاعبين حقيقيين</div></div><div className="setup-layout"><section className="paper-card"><div className="card-heading"><div><h2>عدد المتنافسين</h2><p>كل متنافس سيبني فريقاً مستقلاً.</p></div><UsersRound /></div><div className="count-grid compact">{[2,3,4,5,6].map(n => <button key={n} className={`count-button ${game.playerCount===n?'selected':''}`} onClick={()=>setCount(n)}>{n}</button>)}</div></section><section className="paper-card"><div className="card-heading"><div><h2>أسماء اللاعبين</h2><p>اكتب أسماء أصحاب الفرق.</p></div><UserRound /></div><div className="name-list">{game.owners.map((name,i)=><label className="name-field" key={i}><span className="name-index">{i+1}</span><input className="text-input" value={name} onChange={e=>update({owners:game.owners.map((x,j)=>j===i?e.target.value:x)})} aria-label={`اسم اللاعب ${i+1}`} /></label>)}</div><div className="setup-footer"><button className="utility-button" onClick={onBack}><ArrowRight /> رجوع</button><button className="primary-button" onClick={onContinue} disabled={game.owners.some(n=>!n.trim())}>تجهيز الفرق <ArrowLeft /></button></div></section></div></motion.main>;
}

function TeamSetup({ game, draft, setDraft, onSave, onBack }: { game:GameState; draft:Footballer[]; setDraft:(d:Footballer[])=>void; onSave:()=>void; onBack:()=>void }) {
  const bossCount = draft.filter(p=>p.isBoss).length;
  const toggleBoss = (i:number) => { if (!draft[i].isBoss && bossCount >= 2) return; setDraft(draft.map((p,j)=>j===i?{...p,isBoss:!p.isBoss}:p)); };
  return <motion.main className="setup-wrap" initial={{opacity:0}} animate={{opacity:1}}><div className="eyebrow">تجهيز الفريق {game.setupIndex+1} من {game.playerCount}</div><div className="game-header"><div><h1>تشكيلة {game.owners[game.setupIndex]}</h1><p className="section-desc">مرّر الجهاز لصاحب الفريق فقط. اختيارات الزعماء سرية.</p></div><div className="round-marker"><strong>{bossCount}/2</strong> زعماء محددون</div></div><section className="paper-card"><div className="card-heading"><div><h2>قائمة الـ10 لاعبين</h2><p>عدّل الأسماء واضغط على تاج الزعيم بجوار لاعبين فقط.</p></div><Shield /></div><div className="squad-grid">{draft.map((player,i)=><div className={`squad-edit ${player.isBoss?'boss-picked':''}`} key={i}><span className="player-number">{String(i+1).padStart(2,'0')}</span><input className="text-input" value={player.name} onChange={e=>setDraft(draft.map((p,j)=>j===i?{...p,name:e.target.value}:p))} aria-label={`اسم لاعب الكرة ${i+1}`} /><button className="boss-toggle" onClick={()=>toggleBoss(i)} aria-pressed={player.isBoss}>{player.isBoss?<Check />:<Shield />}<span>{player.isBoss?'زعيم':'تحديد'}</span></button></div>)}</div><div className="privacy-callout"><Eye /> <span>لا تعرض هذه الشاشة للخصوم. لن تظهر هوية الزعيم إلا بعد اتهامه.</span></div><div className="setup-footer"><button className="utility-button" onClick={onBack} disabled={game.setupIndex>0}><ArrowRight /> العودة</button><button className="primary-button" onClick={onSave} disabled={bossCount!==2 || draft.some(p=>!p.name.trim())}>{game.setupIndex===game.playerCount-1?'ابدأ المواجهة':'احفظ ومرّر الجهاز'} <ArrowLeft /></button></div></section></motion.main>;
}

function GameView({ game, setGame, onReset }: { game:GameState; setGame:(g:GameState)=>void; onReset:()=>void }) {
  const attacker = game.teams[game.turn];
  const currentQuestion = questions[(game.round-1)%questions.length];
  const validTeams = game.teams.map((t,i)=>({t,i})).filter(({t,i})=>i!==game.turn && t.footballers.some(p=>p.status==='active'));
  const selected = game.targetTeam!==null && game.targetPlayer!==null ? game.teams[game.targetTeam].footballers[game.targetPlayer] : null;
  const update = (c:Partial<GameState>) => setGame({...game,...c});
  const reveal = () => { if (game.targetTeam===null || game.targetPlayer===null) return; const teams=game.teams.map((t,ti)=>ti===game.targetTeam?{...t,footballers:t.footballers.map((p,pi)=>pi===game.targetPlayer?{...p,revealed:true}:p)}:t); setGame({...game,teams,phase:'reveal'}); };
  const act = (action:'exclude'|'assassinate') => {
    if(game.targetTeam===null||game.targetPlayer===null||!selected) return;
    if(action==='assassinate'&&(!selected.isBoss||!selected.revealed)) return;
    const status: Footballer['status'] = action === 'assassinate' ? 'assassinated' : 'excluded';
    const teams=game.teams.map((t,ti)=>ti===game.targetTeam?{...t,footballers:t.footballers.map((p,pi)=>pi===game.targetPlayer?{...p,status}:p)}:t);
    const aliveTeams=teams.map((t,i)=>({i,alive:t.footballers.some(p=>p.isBoss&&p.status!=='assassinated')})).filter(x=>x.alive);
    const history=[...game.history,{round:game.round,attacker:attacker.owner,target:`${selected.name} — ${game.teams[game.targetTeam].owner}`,action}];
    if(aliveTeams.length===1) setGame({...game,teams,history,winner:aliveTeams[0].i,phase:'ending'});
    else { let next=(game.turn+1)%teams.length; while(!aliveTeams.some(x=>x.i===next)) next=(next+1)%teams.length; setGame({...game,teams,history,turn:next,round:game.round+1,phase:'question',targetTeam:null,targetPlayer:null,notes:''}); }
  };
  if(game.phase==='ending') return <EndingView game={game} onReset={onReset}/>;
  return <motion.main className="game-wrap" initial={{opacity:0}} animate={{opacity:1}}><div className="game-header"><div><div className="eyebrow">دور {attacker.owner}</div><h1>{game.phase==='question'?'غرفة التحقيق':game.phase==='target'?'حدد هدفك':'تم كشف الهوية'}</h1></div><div className="round-marker"><strong>{game.round}</strong> الجولة الحالية</div></div><div className="turn-banner"><Target /><div><strong>{attacker.owner} يهاجم الآن</strong><span>اختر لاعباً من فريق خصمك. لا يمكنك استهداف فريقك.</span></div></div><div className="phase-layout"><section className="paper-card phase-card">
    {game.phase==='question'&&<><div className="phase-icon"><CircleHelp /></div><h2>سؤال الجولة</h2><p className="large-copy">ناقش السؤال مع خصومك وابحث عن أي دفاع يكشف ترتيب العصابة.</p><div className="question-quote">« {currentQuestion} »</div><textarea className="answer-box" value={game.notes} onChange={e=>update({notes:e.target.value})} placeholder="دوّن ملاحظاتك عن الإجابات..."/><button className="primary-button action-gap" onClick={()=>update({phase:'target'})}>ابدأ الكشف <ArrowLeft /></button></>}
    {game.phase==='target'&&<><div className="phase-icon"><Crosshair /></div><h2>اختر فريق الخصم</h2><div className="opponent-tabs">{validTeams.map(({t,i})=><button key={i} className={`opponent-tab ${game.targetTeam===i?'selected':''}`} onClick={()=>update({targetTeam:i,targetPlayer:null})}>{t.owner}<span>{t.footballers.filter(p=>p.status==='active').length} متاح</span></button>)}</div>{game.targetTeam!==null&&<div className="footballer-grid">{game.teams[game.targetTeam].footballers.map((p,i)=><button key={i} disabled={p.status!=='active'} className={`footballer-card ${game.targetPlayer===i?'selected':''} ${p.status!=='active'?'out':''}`} onClick={()=>update({targetPlayer:i})}><UserRound /><strong>{p.name}</strong><span>{p.status==='active'?(p.revealed&&p.isBoss?'زعيم مكشوف':'متاح'):p.status==='assassinated'?'تم اغتياله':'مستبعد'}</span></button>)}</div>}<button className="primary-button action-gap" disabled={game.targetPlayer===null} onClick={reveal}>اكشف الهوية <Eye /></button></>}
    {game.phase==='reveal'&&selected&&<><div className={`reveal-result ${selected.isBoss?'is-boss':''}`}><div className="result-symbol">{selected.isBoss?<Skull />:<UserRound />}</div><span>تم كشف</span><h2>{selected.name}</h2><strong>{selected.isBoss?'زعيم عصابة':'لاعب عادي'}</strong><p>{selected.isBoss?'تم كشف الزعيم. أصبح أمر الاغتيال متاحاً الآن.':'ليس زعيماً. يمكنك استبعاده من قائمة الخصم.'}</p></div><div className="decision-actions">{selected.isBoss?<button className="danger-button" onClick={()=>act('assassinate')}><Crosshair /> اغتيال الزعيم</button>:<button className="primary-button" onClick={()=>act('exclude')}><UserRound /> استبعاد اللاعب</button>}</div></>}
  </section><TeamStatus teams={game.teams} turn={game.turn} history={game.history} onReset={onReset}/></div></motion.main>;
}

function TeamStatus({teams,turn,history,onReset}:{teams:Team[];turn:number;history:HistoryItem[];onReset:()=>void}) { return <aside className="paper-card players-card"><div className="card-heading"><div><h2>حالة الفرق</h2><p>سجل القوة المتبقية.</p></div><Flag /></div><div className="team-status-list">{teams.map((team,i)=>{const bosses=team.footballers.filter(p=>p.isBoss&&p.status!=='assassinated').length;return <div className={`team-status ${i===turn?'current':''}`} key={i}><div><strong>{team.owner}</strong><span>{team.footballers.filter(p=>p.status==='active').length} لاعبين متاحين</span></div><div className="boss-lives"><Skull /> {bosses}/2</div></div>})}</div>{history.length>0&&<div className="history-panel"><h3>آخر العمليات</h3>{history.slice(-3).reverse().map((h,i)=><p key={i}><strong>{h.attacker}</strong> {h.action==='assassinate'?'اغتال':'استبعد'} {h.target}</p>)}</div>}<button className="utility-button action-gap" onClick={onReset}><RotateCcw /> غرفة جديدة</button></aside> }

function EndingView({game,onReset}:{game:GameState;onReset:()=>void}) { const winner=game.winner===null?null:game.teams[game.winner]; return <motion.main className="game-wrap" initial={{opacity:0}} animate={{opacity:1}}><section className="paper-card result-hero"><div className="result-symbol"><Shield /></div><div className="eyebrow centered">انتهت المواجهة</div><h1>فريق {winner?.owner} انتصر</h1><p>بقي لهذا الفريق زعيم واحد على الأقل، بينما تم اغتيال زعماء كل الفرق المنافسة.</p><div className="winner-squad">{winner?.footballers.filter(p=>p.isBoss).map(p=><div className="player-row" key={p.name}><span>{p.name}</span><span className="status-tag target">{p.status==='assassinated'?'مغتال':'زعيم ناجٍ'}</span></div>)}</div><button className="primary-button" onClick={onReset}><RotateCcw /> افتح غرفة جديدة</button></section></motion.main> }

function RulesModal({onClose}:{onClose:()=>void}) { return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} onClick={onClose}><motion.div className="paper-card rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={e=>e.stopPropagation()}><div className="card-heading"><div><div className="eyebrow">دليل اللعب</div><h2 id="rules-title">قواعد عصابة الملاعب</h2></div><button className="utility-button" onClick={onClose}>إغلاق</button></div><ol className="modal-list"><li><strong>كل لاعب حقيقي</strong> ينشئ فريقاً مستقلاً من 10 لاعبي كرة.</li><li>يختار صاحب الفريق <strong>زعيمين فقط</strong> يظلان سريين.</li><li>في كل جولة يجيب اللاعبون عن سؤال، ثم يختار صاحب الدور هدفاً من فريق خصم.</li><li>يتم كشف هوية الهدف: اللاعب العادي يُستبعد، والزعيم المكشوف يمكن اغتياله.</li><li>يفوز آخر فريق يبقى لديه زعيم عصابة حي.</li></ol></motion.div></motion.div> }

function Router(){return <RoutedErrorBoundary><Switch><Route path="/" component={Home}/><Route component={NotFound}/></Switch></RoutedErrorBoundary>}
function Home(){return <App/>}
function RoutedErrorBoundary({children}:{children:ReactNode}){const[location]=useLocation();return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>}
function RootApp(){return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>}
export default RootApp;
