// Promo film "Bir işin yolculuğu" (KARARLAR Rev 43; screenplay docs/film/tanitim-senaryosu.md): the 18 scenes, their
// captions, the dialogue lines and what moves each scene on. Data only, pure. The film job is `film-flagship`
// (filmScenario.json, outside the random pool); scenes 3–17 follow its workflow events, 1, 2, 12, 13 and 18 are
// director shots (12–13 are inserted while the engineers build).
import type { EventType } from '../sim/workflow';

export const FILM_VARIANT = 'film-flagship';
export const FILM_TITLE = 'Kooperatif Pazarı';

/** What lets the film enter a scene: an engine event of the film job (latched), or time in the previous scene. */
export type SceneTrigger =
  | { kind: 'event'; type: EventType; step: string }
  /** The step's timed part runs (all actors arrived). */
  | { kind: 'active'; step: string }
  | { kind: 'after'; seconds: number };

/** Fixed camera places (tour-style shots); the director maps them onto tour segments. */
export const FILM_PLACES = ['overview', 'lobby', 'meeting', 'engineering', 'rnd', 'gym', 'finale'] as const;
export type FilmPlace = (typeof FILM_PLACES)[number];

export type FilmShot = { kind: 'place'; place: FilmPlace } | { kind: 'follow'; unit: string };

export interface FilmScene {
  n: number;
  title: string;
  text: string;
  /** Nominal length in the screenplay (seconds). */
  nominalS: number;
  /** The scene is held at least this long (caption readable) before the next one may start. */
  minS: number;
  /** Entry condition (scene 1 starts with the film). */
  enter: SceneTrigger | null;
  /** Director-driven shots for scenes without a workflow focus: `[at seconds, shot]`, in order. */
  shots?: readonly (readonly [number, FilmShot])[];
  /** Office clock ("HH:MM") at the scene's start and where it drifts to by its nominal end. */
  office: readonly [string, string];
}

const place = (p: FilmPlace): FilmShot => ({ kind: 'place', place: p });
const follow = (unit: string): FilmShot => ({ kind: 'follow', unit });
const ev = (type: EventType, step: string): SceneTrigger => ({ kind: 'event', type, step });

/** The 18 scenes; captions and titles are the screenplay table's text. */
export const FILM_SCENES: readonly FilmScene[] = [
  { n: 1, title: 'Açılış', text: 'Sabah 08:30. Şirket uyanıyor.', nominalS: 6, minS: 6, enter: null, shots: [[0, place('overview')]], office: ['08:30', '08:40'] },
  { n: 2, title: 'CEO geliyor', text: 'CEO yeni bir işle geldi.', nominalS: 6, minS: 5.5, enter: { kind: 'after', seconds: 6 }, shots: [[0, place('lobby')], [3, follow('ceo')]], office: ['08:40', '08:50'] },
  { n: 3, title: 'İş zarfı', text: 'Kooperatif Pazarı: web, mobil ve API.', nominalS: 6, minS: 5.5, enter: { kind: 'active', step: 'intake' }, office: ['08:50', '08:55'] },
  { n: 4, title: 'Araştırma', text: 'Ürün: pazar ve rakipler. Keşifçi: hazır çözüm var mı?', nominalS: 6, minS: 5, enter: ev('step-start', 'c-pm'), office: ['08:55', '09:00'] },
  { n: 5, title: 'Mimari', text: 'Mimari: seçenekler ve ödünleşimler.', nominalS: 6, minS: 5, enter: ev('step-start', 'c-ar'), office: ['09:00', '09:03'] },
  { n: 6, title: 'Spec', text: "İş Analisti imzalanabilir spec'i yazıyor.", nominalS: 5, minS: 4.5, enter: ev('step-start', 'c-ba'), office: ['09:03', '09:05'] },
  { n: 7, title: 'Toplantı odası', text: 'Üç kapı aynı anda: eleştiri, güvenlik, mimari.', nominalS: 9, minS: 8, enter: ev('step-start', 'meet'), office: ['09:05', '09:08'] },
  { n: 8, title: 'Ret ve düzeltme', text: 'Açık bulundu. Spec düzeltiliyor.', nominalS: 5, minS: 5, enter: ev('reject', 'gates'), office: ['09:08', '09:10'] },
  { n: 9, title: 'İmza', text: 'İmza yoksa kod da yok.', nominalS: 5, minS: 5, enter: ev('step-start', 'sign'), office: ['09:10', '09:12'] },
  { n: 10, title: 'Plan', text: 'Teslimat: plan, dallar, iş listesi.', nominalS: 5, minS: 4.5, enter: ev('step-start', 'c-dm'), office: ['09:12', '09:14'] },
  { n: 11, title: 'Kodlama', text: 'Dört mühendis paralel kodluyor.', nominalS: 13, minS: 13, enter: ev('step-start', 'b-api'), office: ['10:50', '11:00'] },
  { n: 12, title: 'Ar-Ge', text: 'Ar-Ge: şirketin beyni.', nominalS: 5.5, minS: 5.5, enter: { kind: 'after', seconds: 13 }, shots: [[0, place('rnd')]], office: ['11:00', '11:05'] },
  { n: 13, title: 'Mola', text: 'Öğle arası. Herkes için.', nominalS: 6, minS: 6, enter: { kind: 'after', seconds: 5.5 }, shots: [[0, place('gym')]], office: ['12:30', '12:50'] },
  { n: 14, title: 'QA', text: 'QA kodu bozarak dener.', nominalS: 6, minS: 5.5, enter: ev('step-start', 'c-qa'), office: ['13:30', '13:35'] },
  { n: 15, title: 'Güvenlik ve denetim', text: 'Güvenlik, denetim, kalite.', nominalS: 6, minS: 5, enter: ev('step-start', 'c-as'), office: ['13:35', '13:40'] },
  { n: 16, title: 'İletişim', text: 'Kullanım kılavuzu ve tanıtım metni hazır.', nominalS: 5, minS: 4.5, enter: ev('call', 'comms'), office: ['13:40', '13:45'] },
  { n: 17, title: 'Teslim', text: 'Kanıt var, iş bitti.', nominalS: 6, minS: 5.5, enter: ev('step-start', 'c-ceo'), office: ['13:45', '13:50'] },
  { n: 18, title: 'Kapanış', text: 'Ajans. Her iş, uçtan uca.', nominalS: 6, minS: 6, enter: ev('step-start', 'c-ev'), shots: [[0, place('finale')]], office: ['17:20', '17:50'] },
];

/** Scenes the director shoots itself (no workflow focus). */
export const DIRECTOR_SCENES: ReadonlySet<number> = new Set([1, 2, 12, 13, 18]);

/** Who speaks a line: a unit id, a staff NPC (`staff:…`) or `here` (the robot nearest the shot). */
export type Speaker = string;

export type LineCue =
  | { kind: 'scene'; scene: number; at: number }
  /** `n`: the n-th such event of the film job (1-based, default 1). */
  | { kind: 'event'; type: EventType; step: string; n?: number; at: number };

export interface FilmLine {
  /** Screenplay scene number of the row. */
  scene: number;
  speaker: Speaker;
  /** The screenplay's "Konuşan → dinleyen" column (documentation, tests). */
  who: string;
  text: string;
  cue: LineCue;
}

const at = (scene: number, s: number): LineCue => ({ kind: 'scene', scene, at: s });
const on = (type: EventType, step: string, s: number, n = 1): LineCue => ({ kind: 'event', type, step, n, at: s });

/** The screenplay's "Diyaloglar" table, row by row, each with the moment it plays. */
export const FILM_LINES: readonly FilmLine[] = [
  { scene: 2, speaker: 'staff:guard-desk', who: 'Güvenlik → CEO', text: 'Günaydın efendim!', cue: at(2, 0.4) },
  { scene: 2, speaker: 'ceo', who: 'CEO → Güvenlik', text: 'Günaydın, bugün büyük gün.', cue: at(2, 3.0) },
  { scene: 3, speaker: 'ceo', who: 'CEO → Chief of Staff', text: 'Kooperatif Pazarı. Üreticiler doğrudan satsın.', cue: at(3, 0.4) },
  { scene: 3, speaker: 'chief-of-staff', who: 'Chief of Staff → CEO', text: 'Lane 3. Tüm ekibi topluyorum.', cue: at(3, 2.6) },
  { scene: 4, speaker: 'product-manager', who: 'Ürün Yöneticisi → Keşifçi', text: 'Rakipler komisyonu yüksek tutuyor.', cue: on('step-start', 'mkt', 0.8) },
  { scene: 4, speaker: 'scout', who: 'Keşifçi → Ürün Yöneticisi', text: 'Ödeme için hazır kütüphane var, sıfırdan yazmayalım.', cue: on('step-start', 'scan', 0.8) },
  { scene: 5, speaker: 'software-architect', who: 'Yazılım Mimarı → Mimari Kurul', text: 'API önde, web ve mobil aynı servisi kullansın.', cue: on('step-start', 'design', 0.8) },
  { scene: 5, speaker: 'architecture-board', who: 'Mimari Kurul → Yazılım Mimarı', text: 'Yeni bağımlılık için gerekçe yaz.', cue: on('handover', 'c-ab', 0.1) },
  { scene: 6, speaker: 'business-analyst', who: 'İş Analisti → Chief of Staff', text: 'Spec hazır: 14 kabul kriteri.', cue: on('step-start', 'spec', 1.2) },
  { scene: 7, speaker: 'spec-critic', who: 'Spec Eleştirmeni → İş Analisti', text: 'İade süreci nerede?', cue: on('handover', 'g-sc', 0.3) },
  { scene: 7, speaker: 'appsec', who: 'AppSec → İş Analisti', text: 'Ödeme verisi saklanmayacak, değil mi?', cue: on('handover', 'g-as', 0.3) },
  { scene: 8, speaker: 'business-analyst', who: 'İş Analisti → Spec Eleştirmeni', text: 'İade akışını ekledim.', cue: on('step-end', 'rework', 0) },
  { scene: 8, speaker: 'spec-critic', who: 'Spec Eleştirmeni → İş Analisti', text: 'Şimdi oldu.', cue: on('step-end', 'g-sc', 0, 2) },
  { scene: 9, speaker: 'ceo', who: 'CEO → Chief of Staff', text: 'Onaylıyorum. Başlayın.', cue: on('sign', 'sign', 0) },
  { scene: 10, speaker: 'delivery-manager', who: 'Teslimat Yöneticisi → Mühendisler', text: 'Dört dal, iki hafta. Önce testler.', cue: on('step-start', 'plan', 0.8) },
  { scene: 11, speaker: 'react-engineer', who: 'React Mühendisi → .NET Mühendisi', text: 'Sepet uç noktası hazır mı?', cue: at(11, 1.0) },
  { scene: 11, speaker: 'dotnet-engineer', who: '.NET Mühendisi → React Mühendisi', text: 'Beş dakika, test yeşile dönüyor.', cue: at(11, 3.6) },
  { scene: 11, speaker: 'devops-sre', who: 'DevOps → Çok Dilli Mühendis', text: 'Docker imajı hazır.', cue: at(11, 6.2) },
  { scene: 12, speaker: 'here', who: 'Ar-Ge lideri → ekip', text: 'Ya teslimat rotasını yapay zekâ çizse?', cue: at(12, 1.0) },
  { scene: 13, speaker: 'staff:tea', who: 'Çaycı → Mühendis', text: 'Çayınız taze!', cue: at(13, 0.6) },
  { scene: 13, speaker: 'here', who: 'Mühendis → Mühendis', text: 'Bir set daha, sonra koda dönüyoruz.', cue: at(13, 3.2) },
  { scene: 14, speaker: 'qa-engineer', who: 'QA Mühendisi → .NET Mühendisi', text: 'Boş sepetle ödeme geçti. Kırmızı!', cue: on('step-end', 'test', 0, 1) },
  { scene: 14, speaker: 'dotnet-engineer', who: '.NET Mühendisi → QA Mühendisi', text: 'Düzelttim, tekrar dene.', cue: on('step-end', 'fix', 0) },
  { scene: 14, speaker: 'qa-engineer', who: 'QA Mühendisi → .NET Mühendisi', text: 'Yeşil.', cue: on('step-end', 'test', 0, 2) },
  { scene: 15, speaker: 'appsec', who: 'AppSec → İç Denetçi', text: 'Sır yok, girdi doğrulaması tamam.', cue: on('step-start', 'rev-as', 0.6) },
  { scene: 15, speaker: 'internal-auditor', who: 'İç Denetçi → Kalite Ofisi', text: 'Her kriterin kanıtı var.', cue: on('step-start', 'rev-ia', 0.6) },
  { scene: 16, speaker: 'marketing', who: 'Pazarlama → Teknik İletişim', text: 'Slogan: Tarladan sofraya, aracısız.', cue: on('step-start', 'w-mk', 0.8) },
  { scene: 17, speaker: 'chief-of-staff', who: 'Chief of Staff → CEO', text: 'Testler yeşil, denetim temiz. Teslime hazır.', cue: on('handover', 'c-ceo', 0) },
  { scene: 17, speaker: 'ceo', who: 'CEO → herkes', text: 'Harika iş. Herkese teşekkürler!', cue: on('step-start', 'accept', 1.2) },
];

/** Scripted outcomes: the spec critic sends the spec back once (↺), QA goes red once, then green. */
export const FILM_OUTCOMES = { 'g-sc': ['reject', 'pass'], 'g-as': ['pass', 'pass'], 'g-ab': ['pass', 'pass'], test: ['reject', 'pass'] } as const;

/**
 * Film speed multipliers (CEO film review "daha hızlı bir çekim istiyorum"): walks, waits and the arrival 8×, desk
 * work 4×, key moments and the director's place shots 1.5×.
 */
export const FILM_SPEED = { walk: 8, work: 4, key: 1.5 } as const;

/** Key moments run at FILM_SPEED.key (stamp, meeting, gates, coding, QA lamp, acceptance). */
export const KEY_STEPS: ReadonlySet<string> = new Set(['meet', 'sign', 'b-api', 'b-ops', 'test', 'fix', 'accept']);

/** Steps shot as a framed room / floor rather than following one robot. */
export const PLACE_STEPS: Readonly<Record<string, FilmPlace>> = {
  meet: 'meeting',
  gates: 'meeting',
  'g-sc': 'meeting',
  'g-as': 'meeting',
  'g-ab': 'meeting',
  rework: 'meeting',
  code: 'engineering',
  'b-api': 'engineering',
  'b-ops': 'engineering',
};

/** Seconds a line stays on screen (screenplay: at most 2.5 s). */
export const LINE_S = 2.5;
/** At most this many bubbles at once (screenplay). */
export const MAX_BUBBLES = 2;
/** Caption fade in / out (seconds). */
export const CAPTION_FADE_S = 0.5;
