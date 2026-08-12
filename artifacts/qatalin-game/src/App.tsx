import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  Camera,
  Check,
  ChevronLeft,
  CircleHelp,
  Crosshair,
  Eye,
  FileWarning,
  Flag,
  KeyRound,
  RotateCcw,
  ScanEye,
  Shield,
  Skull,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import referenceArtwork from '@assets/fd10b1bd-72e2-44f2-b5e9-1b6a71042db5_1786524671090.jpg';

type Screen = 'intro' | 'setup' | 'game';
type Phase = 'reveal' | 'question' | 'answer' | 'attack' | 'camera' | 'ending';
type Role = 'leader' | 'killer' | 'citizen';
type HelperCardIcon = 'double' | 'question' | 'shield' | 'info' | 'swap' | 'camera';

type GameState = {
  screen: Screen;
  phase: Phase;
  playerCount: number;
  names: string[];
  roles: Role[];
  alive: boolean[];
  round: number;
  revealIndex: number;
  selectedTarget: number | null;
  answer: string;
  lastEliminated: number | null;
  winner: 'group' | 'killers' | null;
  helperHistory: HelperDraw[];
  lastHelperDraw: HelperDraw | null;
};

type HelperCard = {
  id: string;
  title: string;
  label: string;
  description: string;
  instruction: string;
  icon: HelperCardIcon;
};

type HelperDraw = {
  cardId: string;
  playerIndex: number;
  round: number;
};

const queryClient = new QueryClient();
const STORAGE_KEY = 'qatalin-active-case';
const defaultNames = ['راشد', 'ليان', 'سامي', 'نور', 'كريم', 'جود', 'فهد', 'تالا', 'ياسر', 'ميرا', 'عمر', 'سارة', 'آدم', 'ريم', 'مازن'];
const questions = [
  'من أكثر شخص تغيّر سلوكه منذ بداية الجولة؟ وما الذي لاحظته تحديداً؟',
  'لو كان عليك حماية لاعب واحد الليلة، فمن تختار؟ ولماذا؟',
  'ما الإجابة التي شعرت أنها مصطنعة أو متأخرة أكثر من اللازم؟',
  'من يملك مصلحة في أن يبقى الجميع منشغلين بالاتهامات؟',
  'ما الدليل الوحيد الذي يجعلك تثق بنفسك في هذه الجولة؟',
];
const helperCards: HelperCard[] = [
  {
    id: 'double-chance',
    title: 'فرصة مضاعفة',
    label: 'X2',
    description: 'يحصل صاحب البطاقة على فرصتين في مرحلة الاتهام القادمة.',
    instruction: 'يحتفظ بها اللاعب حتى نهاية الجولة ويعلن استخدامها قبل تثبيت الاتهام.',
    icon: 'double',
  },
  {
    id: 'cancel-question',
    title: 'إلغاء السؤال',
    label: 'تبديل',
    description: 'يستطيع صاحبها إلغاء سؤال الجولة وطلب سؤال جديد فوراً.',
    instruction: 'تُستخدم مرة واحدة قبل أن يبدأ اللاعبون في الإجابة.',
    icon: 'question',
  },
  {
    id: 'safe-shield',
    title: 'درع الحماية',
    label: 'حماية',
    description: 'ينجو صاحبها من أول اتهام مباشر ضده في هذه الجولة.',
    instruction: 'يكشف اللاعب البطاقة بعد إعلان اسمه وقبل فتح تسجيل الكاميرا.',
    icon: 'shield',
  },
  {
    id: 'confirmed-clue',
    title: 'معلومة مؤكدة',
    label: 'دليل',
    description: 'يحصل صاحبها من المضيف على معلومة صحيحة عن لاعب واحد.',
    instruction: 'يختار اللاعب اسماً واحداً، ويعطيه المضيف معلومة عن هويته.',
    icon: 'info',
  },
  {
    id: 'role-switch',
    title: 'تبديل الأثر',
    label: 'تبديل',
    description: 'يختار صاحبها لاعباً آخر لتبادل بطاقة المساعدة معه.',
    instruction: 'يتم التبديل علناً، لكن لا يكشف أي لاعب دوره السري.',
    icon: 'swap',
  },
  {
    id: 'watch-camera',
    title: 'كاميرا مراقبة',
    label: 'مراقبة',
    description: 'يكشف المضيف لصاحبها معلومة سرية عن دور لاعب واحد.',
    instruction: 'يختار اللاعب اسماً، ويقرأ المضيف المعلومة له وحده.',
    icon: 'camera',
  },
];

function readSavedGame(): GameState | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<GameState>;
    return {
      ...(parsed as GameState),
      helperHistory: parsed.helperHistory ?? [],
      lastHelperDraw: parsed.lastHelperDraw ?? null,
    };
  } catch {
    return null;
  }
}

function makeRoles(count: number): Role[] {
  const roles: Role[] = Array(count).fill('citizen');
  roles[0] = 'leader';
  if (count === 2) {
    roles[1] = 'killer';
    return roles;
  }
  const available = Array.from({ length: count - 1 }, (_, index) => index + 1);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  roles[available[0]] = 'killer';
  roles[available[1]] = 'killer';
  return roles;
}

function freshGame(count: number, names: string[]): GameState {
  return {
    screen: 'game',
    phase: 'reveal',
    playerCount: count,
    names,
    roles: makeRoles(count),
    alive: Array(count).fill(true),
    round: 1,
    revealIndex: 0,
    selectedTarget: null,
    answer: '',
    lastEliminated: null,
    winner: null,
    helperHistory: [],
    lastHelperDraw: null,
  };
}

function App() {
  const [game, setGame] = useState<GameState>(() => readSavedGame() ?? {
    screen: 'intro',
    phase: 'reveal',
    playerCount: 7,
    names: defaultNames.slice(0, 7),
    roles: [],
    alive: [],
    round: 1,
    revealIndex: 0,
    selectedTarget: null,
    answer: '',
    lastEliminated: null,
    winner: null,
    helperHistory: [],
    lastHelperDraw: null,
  });
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  const update = (changes: Partial<GameState>) => setGame((current) => ({ ...current, ...changes }));
  const beginSetup = () => update({ screen: 'setup' });
  const startMatch = () => {
    const names = game.names.slice(0, game.playerCount).map((name, index) => name.trim() || `لاعب ${index + 1}`);
    setGame(freshGame(game.playerCount, names));
  };
  const resetGame = () => {
    if (window.confirm('هل تريد إغلاق الملف الحالي وبدء لعبة جديدة؟')) {
      window.localStorage.removeItem(STORAGE_KEY);
      setGame({
        screen: 'intro',
        phase: 'reveal',
        playerCount: 7,
        names: defaultNames.slice(0, 7),
        roles: [],
        alive: [],
        round: 1,
        revealIndex: 0,
        selectedTarget: null,
        answer: '',
        lastEliminated: null,
        winner: null,
        helperHistory: [],
        lastHelperDraw: null,
      });
    }
  };

  return (
    <div className="game-shell" dir="rtl">
      <div className="frame">
        <header className="topbar" data-testid="header-game-brand">
          <div className="brand-lockup" data-testid="text-brand">
            <div className="brand-mark"><Crosshair size={19} /></div>
            <div><span className="brand-name">قاتلين</span><span className="brand-sub">ملف الخيانة والاستنتاج</span></div>
          </div>
          <button className="utility-button" onClick={() => setShowRules(true)} data-testid="button-open-rules">
            <FileWarning size={15} /> قواعد الملف
          </button>
        </header>

        <AnimatePresence mode="wait">
          {game.screen === 'intro' && <IntroView key="intro" onStart={beginSetup} onRules={() => setShowRules(true)} />}
          {game.screen === 'setup' && (
            <SetupView
              key="setup"
              count={game.playerCount}
              names={game.names}
              onCount={(count) => update({ playerCount: count, names: defaultNames.slice(0, count) })}
              onName={(index, name) => update({ names: game.names.map((old, i) => i === index ? name : old) })}
              onBack={() => update({ screen: 'intro' })}
              onStart={startMatch}
            />
          )}
          {game.screen === 'game' && (
            <GameView key="game" game={game} update={update} onReset={resetGame} />
          )}
        </AnimatePresence>
        <footer className="footer-note" data-testid="text-footer-note">قاتلين — لا تثق بأحد، حتى بصوتك الداخلي</footer>
      </div>
      <AnimatePresence>
        {showRules && <RulesModal key="rules-modal" onClose={() => setShowRules(false)} />}
      </AnimatePresence>
    </div>
  );
}

function IntroView({ onStart, onRules }: { onStart: () => void; onRules: () => void }) {
  return (
    <motion.main className="intro-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">الملف رقم ٠٢ — سري للغاية</div>
          <h1 className="hero-title" data-testid="heading-intro-title">قاتلين<em>قتلة</em></h1>
          <p className="hero-lede" data-testid="text-intro-description">
            في هذه الغرفة قائد واحد، ومطاردون يتركون آثارهم في الظلام. كل لاعب يحمل سراً لا يعرفه الآخرون. اسأل، دافع عن نفسك، واتهم قبل أن تسيطر الخيانة على الطاولة.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onStart} data-testid="button-start-setup">
              افتح الملف <ArrowLeft size={17} />
            </button>
            <button className="ghost-button" onClick={onRules} data-testid="button-read-rules">
              كيف نلعب؟ <CircleHelp size={17} />
            </button>
          </div>
          <div className="hero-note" data-testid="text-intro-note"><KeyRound size={14} /> لعبة جماعية محلية · من ٢ إلى ١٥ لاعباً</div>
        </div>
        <div className="hero-art" data-testid="img-reference-artwork">
          <img src={referenceArtwork} alt="ملف قاتلين الفني" />
          <div className="art-stamp">دليل محفوظ / لا تفتح</div>
        </div>
      </section>
      <section className="intro-rules" data-testid="section-intro-rules">
        <div className="eyebrow">قبل أن تنطفئ الأنوار</div>
        <h2 className="section-title">الغرفة لها ذاكرة.</h2>
        <p className="section-desc">وزّعوا الأدوار سراً، واتركوا الشك يقوم بالباقي.</p>
        <div className="rules-grid">
          {[
            ['٠١', 'تعيين الأدوار', 'اختاروا قائداً واحداً وقاتلين سريين. بقية الطاولة مدنيون يحاولون كشف الحقيقة.'],
            ['٠٢', 'السؤال والدفاع', 'يطرح المضيف سؤال الجولة. استمعوا لكل إجابة؛ التردد أحياناً يقول أكثر من الكلمات.'],
            ['٠٣', 'الهجوم والكشف', 'اختاروا شخصاً واحداً للهجوم. تكشف الكاميرا هويته، ثم تبدأ جولة جديدة أو تنتهي القضية.'],
          ].map(([number, title, body]) => (
            <article className="rule-card" key={number} data-testid={`card-rule-${number}`}>
              <div className="rule-number">{number}</div><h3>{title}</h3><p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </motion.main>
  );
}

function SetupView({
  count, names, onCount, onName, onBack, onStart,
}: {
  count: number; names: string[]; onCount: (count: number) => void; onName: (index: number, name: string) => void; onBack: () => void; onStart: () => void;
}) {
  return (
    <motion.main className="setup-wrap" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="eyebrow">الخطوة الأولى — تجهيز الطاولة</div>
      <div className="game-header">
        <div><h1 data-testid="heading-setup">من في الغرفة؟</h1></div>
        <div className="round-marker"><strong data-testid="text-setup-count">{count}</strong> ملف لاعب</div>
      </div>
      <div className="setup-layout">
        <section className="paper-card" data-testid="panel-player-count">
          <div className="card-heading"><div><h2>عدد اللاعبين</h2><p>اختر من لاعبين إلى خمسة عشر لاعباً.</p></div><UsersRound size={21} color="var(--accent)" /></div>
          <div className="count-grid">
            {Array.from({ length: 14 }, (_, i) => i + 2).map((number) => (
              <button className={`count-button ${count === number ? 'selected' : ''}`} key={number} onClick={() => onCount(number)} data-testid={`button-player-count-${number}`}>{number}</button>
            ))}
          </div>
          <div style={{ marginTop: 28 }}>
            <p className="hint">{count === 2 ? 'في النسخة الثنائية: لاعب يقود الملف ولاعب واحد يطارده في مواجهة مباشرة.' : 'اقتراح: سبعة لاعبين يصنعون توازناً مثالياً بين الفوضى والمنطق.'}</p>
          </div>
        </section>
        <section className="paper-card" data-testid="panel-player-names">
          <div className="card-heading"><div><h2>أسماء الحاضرين</h2><p>الأسماء ستظهر على بطاقات الكشف فقط.</p></div><BadgeAlert size={21} color="var(--primary)" /></div>
          <div className="name-list">
            {Array.from({ length: count }, (_, index) => (
              <label className="name-field" key={index} data-testid={`field-player-${index + 1}`}>
                <span className="name-index">{String(index + 1).padStart(2, '٠')}</span>
                <input className="text-input" value={names[index] ?? ''} onChange={(event) => onName(index, event.target.value)} placeholder={`اسم اللاعب ${index + 1}`} data-testid={`input-player-name-${index + 1}`} />
              </label>
            ))}
          </div>
          <div className="setup-footer">
            <button className="utility-button" onClick={onBack} data-testid="button-back-intro"><ArrowRight size={15} /> العودة للملف</button>
            <button className="primary-button" onClick={onStart} data-testid="button-start-match">وزّع البطاقات <Sparkles size={16} /></button>
          </div>
        </section>
      </div>
    </motion.main>
  );
}

function GameView({ game, update, onReset }: { game: GameState; update: (changes: Partial<GameState>) => void; onReset: () => void }) {
  const activePlayers = useMemo(() => game.names.map((name, index) => ({ name, index, alive: game.alive[index] })), [game.names, game.alive]);
  const progress = game.phase === 'reveal' ? ((game.revealIndex + 1) / game.playerCount) * 25 : game.phase === 'question' ? 40 : game.phase === 'answer' ? 58 : game.phase === 'attack' ? 76 : 92;
  const currentQuestion = questions[(game.round - 1) % questions.length];
  const selectedRole = game.selectedTarget !== null ? game.roles[game.selectedTarget] : null;
  const continueReveal = () => {
    if (game.revealIndex < game.playerCount - 1) update({ revealIndex: game.revealIndex + 1 });
    else update({ phase: 'question' });
  };
  const confirmAttack = () => {
    if (game.selectedTarget !== null) update({ phase: 'camera' });
  };
  const resolveCamera = () => {
    if (game.selectedTarget === null) return;
    const target = game.selectedTarget;
    const nextAlive = game.alive.map((alive, index) => index === target ? false : alive);
    const targetRole = game.roles[target];
    const remainingKillers = game.roles.filter((role, index) => role === 'killer' && nextAlive[index]).length;
    if (targetRole === 'leader') update({ alive: nextAlive, lastEliminated: target, winner: 'killers', phase: 'ending' });
    else if (remainingKillers === 0) update({ alive: nextAlive, lastEliminated: target, winner: 'group', phase: 'ending' });
    else update({ alive: nextAlive, lastEliminated: target, round: game.round + 1, phase: 'question', selectedTarget: null, answer: '' });
  };
  const drawHelperCard = () => {
    const alivePlayers = game.alive
      .map((alive, index) => alive ? index : null)
      .filter((index): index is number => index !== null);
    if (!alivePlayers.length) return;
    const usedThisRound = new Set(
      game.helperHistory
        .filter((draw) => draw.round === game.round)
        .map((draw) => draw.cardId),
    );
    const availableCards = helperCards.filter((card) => !usedThisRound.has(card.id));
    const cardPool = availableCards.length ? availableCards : helperCards;
    const card = cardPool[Math.floor(Math.random() * cardPool.length)];
    const playerIndex = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const draw: HelperDraw = { cardId: card.id, playerIndex, round: game.round };
    update({
      lastHelperDraw: draw,
      helperHistory: [...game.helperHistory, draw],
    });
  };
  const phaseLabels: Record<Phase, string> = { reveal: 'كشف الهوية', question: 'مرحلة السؤال', answer: 'الدفاع والإجابة', attack: 'مرحلة الهجوم', camera: 'عين الكاميرا', ending: 'إغلاق القضية' };
  const phaseIcon: Record<Phase, ReactNode> = { reveal: <Eye size={21} />, question: <CircleHelp size={21} />, answer: <Shield size={21} />, attack: <Target size={21} />, camera: <Camera size={21} />, ending: <Flag size={21} /> };

  return (
    <motion.main className="game-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="game-header">
        <div><div className="eyebrow">{phaseLabels[game.phase]}</div><h1 data-testid="heading-current-phase">{game.phase === 'ending' ? 'النهاية' : 'الغرفة تراقب'}</h1></div>
        <div className="round-marker"><strong data-testid="text-round-number">{game.round}</strong> الجولة الحالية</div>
      </div>
      <div className="progress-line" data-testid="progress-game">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {game.phase === 'ending' ? (
        <EndingView game={game} onReset={onReset} />
      ) : (
        <div className="phase-layout">
          <AnimatePresence mode="wait">
            <motion.section className={`paper-card phase-card ${game.phase === 'camera' ? 'camera-card' : ''}`} key={game.phase} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} data-testid={`panel-phase-${game.phase}`}>
              <div className="phase-icon">{phaseIcon[game.phase]}</div>
              {game.phase === 'reveal' && <RevealPhase game={game} onContinue={continueReveal} />}
              {game.phase === 'question' && <QuestionPhase question={currentQuestion} onContinue={() => update({ phase: 'answer' })} />}
              {game.phase === 'answer' && <AnswerPhase answer={game.answer} onAnswer={(answer) => update({ answer })} onContinue={() => update({ phase: 'attack' })} />}
              {game.phase === 'attack' && <AttackPhase game={game} onSelect={(selectedTarget) => update({ selectedTarget })} onContinue={confirmAttack} />}
              {game.phase === 'camera' && <CameraPhase game={game} role={selectedRole} onContinue={resolveCamera} />}
            </motion.section>
          </AnimatePresence>
          <section className="paper-card players-card" data-testid="panel-player-status">
            <div className="card-heading"><div><h2>سجل الحاضرين</h2><p>لا أحد يخرج من عينك.</p></div><ScanEye size={21} color="var(--accent)" /></div>
            <div className="player-list">
              {activePlayers.map((player) => (
                <div className={`player-row ${player.alive ? '' : 'dead'}`} key={player.index} data-testid={`row-player-status-${player.index}`}>
                  <div className="player-person"><span className="player-number">{String(player.index + 1).padStart(2, '٠')}</span><span data-testid={`text-player-name-${player.index}`}>{player.name}</span></div>
                  <span className={`status-tag ${player.alive ? 'alive' : ''}`}>{player.alive ? 'في الغرفة' : 'خارج القضية'}</span>
                </div>
              ))}
            </div>
            <button className="utility-button" style={{ marginTop: 22 }} onClick={onReset} data-testid="button-reset-game"><RotateCcw size={15} /> ملف جديد</button>
            <HelperCardPanel game={game} onDraw={drawHelperCard} />
          </section>
        </div>
      )}
    </motion.main>
  );
}

function RevealPhase({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const role = game.roles[game.revealIndex];
  const roleTitle = role === 'killer' ? 'قاتل سري' : role === 'leader' ? 'الزعيم' : 'مدني';
  const roleDescription = role === 'killer' ? 'مهمتك إسكات الزعيم. لا تترك أثراً، ولا تدع نظراتك تفضح شريكك.' : role === 'leader' ? 'الجميع يراقبك، لكنك لا تعرف من يطاردك. قُد الغرفة بحذر.' : 'ابحث عن التناقضات. صوتك ودقتك هما السلاح الوحيد ضد الخيانة.';
  return (
    <>
      <h2>بطاقتك السرية</h2>
      <p className="large-copy">مرّر الجهاز إلى <strong className="role-name" data-testid="text-reveal-player">{game.names[game.revealIndex]}</strong> فقط. لا تسمح لأحد برؤية الشاشة.</p>
      <div className="reveal-stage">
        <div className="secret-card" data-testid={`card-secret-role-${game.revealIndex}`}>
          <div className="secret-content"><UserRound size={30} color="var(--accent)" /><div className="secret-label">هوية اللاعب</div><h3>{roleTitle}</h3><div className="secret-label">{roleDescription}</div></div>
        </div>
      </div>
      <button className="primary-button" onClick={onContinue} data-testid="button-continue-reveal">{game.revealIndex === game.playerCount - 1 ? 'إخفاء البطاقة وابدأ' : 'أغلق البطاقة للاعب التالي'} <ChevronLeft size={16} /></button>
    </>
  );
}

function QuestionPhase({ question, onContinue }: { question: string; onContinue: () => void }) {
  return (
    <>
      <h2>السؤال في المنتصف</h2>
      <p className="large-copy">اسألوا كل لاعب على حدة. لا تقاطعوا، لكن سجّلوا كل تفصيلة تبدو في غير مكانها.</p>
      <div className="question-quote" data-testid="text-round-question">« {question} »</div>
      <button className="primary-button" onClick={onContinue} data-testid="button-finish-question">انتهى السؤال <ArrowLeft size={16} /></button>
    </>
  );
}

function AnswerPhase({ answer, onAnswer, onContinue }: { answer: string; onAnswer: (answer: string) => void; onContinue: () => void }) {
  return (
    <>
      <h2>دافع عن نفسك</h2>
      <p className="large-copy">امنح كل شخص لحظة لشرح موقفه. يمكن للمضيف كتابة ملاحظة قصيرة من الإجابات قبل بدء الاتهام.</p>
      <textarea className="answer-box" value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="ملاحظة المضيف عن الإجابات..." data-testid="textarea-answer-notes" />
      <div style={{ marginTop: 18 }}><button className="primary-button" onClick={onContinue} data-testid="button-finish-answer">إلى طاولة الاتهام <ArrowLeft size={16} /></button></div>
    </>
  );
}

function AttackPhase({ game, onSelect, onContinue }: { game: GameState; onSelect: (index: number) => void; onContinue: () => void }) {
  return (
    <>
      <h2>من ستواجه؟</h2>
      <p className="large-copy">اختاروا اسماً واحداً. هذه التهمة ستفتح تسجيل الكاميرا، ولن يمكن التراجع عنها.</p>
      <div className="player-list" style={{ margin: '22px 0' }}>
        {game.names.map((name, index) => game.alive[index] && (
          <button className={`player-row selectable ${game.selectedTarget === index ? 'selected' : ''}`} key={index} onClick={() => onSelect(index)} data-testid={`button-accuse-player-${index}`}>
            <span className="player-person"><span className="player-number">{String(index + 1).padStart(2, '٠')}</span>{name}</span>
            {game.selectedTarget === index ? <span className="status-tag target"><Check size={15} /></span> : <span className="status-tag">اختيار</span>}
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={onContinue} disabled={game.selectedTarget === null} style={{ opacity: game.selectedTarget === null ? .45 : 1 }} data-testid="button-confirm-accusation">تثبيت الاتهام <Crosshair size={16} /></button>
    </>
  );
}

function helperCardIcon(icon: HelperCardIcon) {
  if (icon === 'double') return <Skull size={22} />;
  if (icon === 'question') return <CircleHelp size={22} />;
  if (icon === 'shield') return <Shield size={22} />;
  if (icon === 'info') return <FileWarning size={22} />;
  if (icon === 'swap') return <RotateCcw size={22} />;
  return <Camera size={22} />;
}

function HelperCardPanel({ game, onDraw }: { game: GameState; onDraw: () => void }) {
  const latestDraw = game.lastHelperDraw;
  const latestCard = latestDraw ? helperCards.find((card) => card.id === latestDraw.cardId) : null;
  const drawnThisRound = game.helperHistory.filter((draw) => draw.round === game.round).length;

  return (
    <div className="helper-panel" data-testid="panel-helper-cards">
      <div className="helper-panel-heading">
        <div>
          <div className="eyebrow">أدوات الخداع</div>
          <h3>بطاقات المساعدة</h3>
        </div>
        <Sparkles size={20} color="var(--accent)" />
      </div>
      <p className="helper-copy">اضغط مرة واحدة ليتم اختيار بطاقة عشوائية وتوزيعها فوراً على لاعب حي.</p>
      <button className="helper-draw-button" onClick={onDraw} data-testid="button-draw-helper-card">
        <Sparkles size={17} /> اسحب بطاقة عشوائية
      </button>
      {latestCard && latestDraw && (
        <motion.div
          className="drawn-helper-card"
          initial={{ opacity: 0, y: 10, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          key={`${latestDraw.round}-${latestDraw.cardId}-${latestDraw.playerIndex}`}
          data-testid="card-latest-helper"
        >
          <div className="helper-card-icon">{helperCardIcon(latestCard.icon)}</div>
          <div className="drawn-helper-content">
            <span className="helper-card-kicker">تم تفعيلها عشوائياً لـ</span>
            <strong data-testid="text-helper-player">{game.names[latestDraw.playerIndex]}</strong>
            <h4 data-testid="text-helper-card-title">{latestCard.title} <span>{latestCard.label}</span></h4>
            <p data-testid="text-helper-card-description">{latestCard.description}</p>
            <div className="helper-instruction"><strong>طريقة التنفيذ:</strong> {latestCard.instruction}</div>
          </div>
        </motion.div>
      )}
      <div className="helper-footer" data-testid="text-helper-round-count">
        <span>بطاقات الجولة {game.round}</span>
        <span>{drawnThisRound} / {helperCards.length} مستخدمة</span>
      </div>
    </div>
  );
}

function CameraPhase({ game, role, onContinue }: { game: GameState; role: Role | null; onContinue: () => void }) {
  const targetName = game.selectedTarget === null ? '' : game.names[game.selectedTarget];
  const roleTitle = role === 'killer' ? 'قاتل سري' : role === 'leader' ? 'الزعيم' : 'مدني';
  const roleColor = role === 'killer' || role === 'leader' ? 'var(--primary)' : 'var(--accent)';
  return (
    <>
      <div className="camera-frame" data-testid="panel-camera-reveal"><div className="camera-cross"><Crosshair size={74} strokeWidth={1} /></div><div style={{ position: 'absolute', top: 22, right: 23, color: 'var(--primary)', fontSize: 10 }}>REC ●</div></div>
      <div className="camera-label"><span>تسجيل الكشف / الجولة {game.round}</span><span data-testid="text-camera-target">{targetName}</span></div>
      <div style={{ textAlign: 'center', marginTop: 20 }}><div className="secret-label">الهوية التي أخفاها</div><div className="role-name" style={{ color: roleColor }} data-testid="text-revealed-role">{roleTitle}</div><p className="hint">{role === 'killer' ? 'أصبت الهدف. قاتل أقل في الظلام.' : role === 'leader' ? 'لقد سقط الزعيم. انتهت مهمة القاتلين.' : 'اتهام خاطئ. الغرفة أصبحت أكثر توتراً.'}</p></div>
      <button className="primary-button" onClick={onContinue} style={{ marginTop: 14 }} data-testid="button-next-round">{role === 'leader' || (role === 'killer' && game.roles.filter((item, index) => item === 'killer' && game.alive[index] && index !== game.selectedTarget).length === 0) ? 'شاهد النتيجة' : 'ابدأ الجولة التالية'} <ArrowLeft size={16} /></button>
    </>
  );
}

function EndingView({ game, onReset }: { game: GameState; onReset: () => void }) {
  const killersWon = game.winner === 'killers';
  const endingCopy = game.playerCount === 2
    ? (killersWon
      ? 'سقط الزعيم قبل أن تصل الحقيقة إلى الضوء. المطارد يغادر الغرفة منتصراً.'
      : 'تم تعقّب المطارد وكشف هويته. هذه المرة، انتصر الشك حين تحوّل إلى دليل.')
    : (killersWon
      ? 'سقط الزعيم قبل أن تصل الحقيقة إلى الضوء. القاتلان سيغادران الغرفة دون أن يعرف أحد اسميهما.'
      : 'تم تعقّب القاتلين وكشف هويتهما. هذه المرة، انتصر الشك حين تحوّل إلى دليل.');
  return (
    <motion.section className="paper-card result-hero" initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} data-testid="panel-game-ending">
      <div className="result-symbol">{killersWon ? <Skull size={38} /> : <Shield size={38} />}</div>
      <div className="eyebrow" style={{ justifyContent: 'center' }}>تقرير ما بعد الحادثة</div>
      <h1 data-testid="heading-game-result">{killersWon ? 'القتلة انتصروا' : 'الغرفة كشفتهم'}</h1>
       <p data-testid="text-game-result">{endingCopy}</p>
      <div className="player-list" style={{ maxWidth: 420, margin: '0 auto 28px' }}>
        {game.names.map((name, index) => game.roles[index] !== 'citizen' && <div className="player-row" key={index} data-testid={`result-role-${index}`}><span className="player-person"><span className="player-number">{name}</span></span><span className="status-tag target">{game.roles[index] === 'killer' ? 'قاتل سري' : 'الزعيم'}</span></div>)}
      </div>
      <button className="primary-button" onClick={onReset} data-testid="button-new-game"><RotateCcw size={16} /> افتح قضية جديدة</button>
    </motion.section>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="modal-rules">
      <motion.div className="paper-card rules-modal" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" data-testid="panel-rules-content">
        <div className="card-heading"><div><div className="eyebrow">دليل اللعب</div><h2 style={{ marginTop: 10 }}>القضية في خمس حركات</h2></div><button className="utility-button" onClick={onClose} data-testid="button-close-rules">إغلاق</button></div>
        <ol className="modal-list">
          <li><strong>وزّع البطاقات:</strong> لكل لاعب هوية سرية؛ في المواجهة الثنائية قائد ومطارد، ومع بقية الأعداد قائد وقاتلان ومدنيون.</li>
          <li><strong>اطرح السؤال:</strong> يقرأ المضيف سؤال الجولة للجميع.</li>
          <li><strong>دافع:</strong> يتحدث اللاعبون، وتُجمع الشكوك على الطاولة.</li>
          <li><strong>ثبّت الاتهام:</strong> اختاروا لاعباً واحداً للهجوم.</li>
          <li><strong>راقب الكشف:</strong> إذا سقط الزعيم يفوز القاتلان، وإذا كُشف القاتلان تفوز المجموعة.</li>
        </ol>
      </motion.div>
    </motion.div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function Home() {
  return <AppExperience />;
}

function AppExperience() {
  return <App />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function RootApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default RootApp;