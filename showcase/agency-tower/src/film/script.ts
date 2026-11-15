// Promo film "Bir işin yolculuğu" (KARARLAR Rev 43; screenplay docs/film/tanitim-senaryosu.md): the 18 scenes, their
// captions, the dialogue lines and what moves each scene on. Data only, pure. The film job is `film-flagship`
// (filmScenario.json, outside the random pool); scenes 3–17 follow its workflow events, 1, 2, 12, 13 and 18 are
// director shots (12–13 are inserted while the engineers build).
import type { EventType } from '../sim/workflow';

export const FILM_VARIANT = 'film-flagship';
export const FILM_TITLE = 'GökRota';

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
  { n: 1, title: 'Açılış', text: 'Saat 08:00. 19 yapay zekâ uzmanı ve bir CEO işbaşında.', nominalS: 7, minS: 7, enter: null, shots: [[0, place('overview')]], office: ['08:00', '08:40'] },
  { n: 2, title: 'CEO geliyor', text: 'Kapıdan yeni bir iş giriyor.', nominalS: 7.5, minS: 7.5, enter: { kind: 'after', seconds: 7 }, shots: [[0, place('lobby')], [3, follow('ceo')]], office: ['08:40', '08:50'] },
  { n: 3, title: 'İş zarfı', text: 'GökRota: dronla teslimatı canlı yöneten platform.', nominalS: 6, minS: 6, enter: { kind: 'active', step: 'intake' }, office: ['08:50', '08:55'] },
  { n: 4, title: 'Araştırma', text: 'Kod yok henüz. Önce pazarı ve hazır çözümleri tarıyoruz.', nominalS: 7, minS: 6, enter: ev('step-start', 'c-pm'), office: ['08:55', '09:00'] },
  { n: 5, title: 'Mimari', text: 'Mimari çiziliyor. Her seçeneğin bedeli kâğıtta.', nominalS: 7, minS: 6, enter: ev('step-start', 'c-ar'), office: ['09:00', '09:03'] },
  { n: 6, title: 'Spec', text: 'Spec: ne yapılacağı ve nasıl test edileceği, tek belgede.', nominalS: 6, minS: 5, enter: ev('step-start', 'c-ba'), office: ['09:03', '09:05'] },
  { n: 7, title: 'Toplantı odası', text: "Üç uzman aynı spec'e aynı anda saldırıyor.", nominalS: 10, minS: 9, enter: ev('step-start', 'meet'), office: ['09:05', '09:08'] },
  { n: 8, title: 'Ret ve düzeltme', text: 'Açık bulundu. Kodda değil, kâğıtta; düzeltmesi ucuz.', nominalS: 6, minS: 6, enter: ev('reject', 'gates'), office: ['09:08', '09:10'] },
  { n: 9, title: 'İmza', text: 'Onay mührü basılmadan tek satır kod yazılmaz.', nominalS: 6, minS: 5.5, enter: ev('step-start', 'sign'), office: ['09:10', '09:12'] },
  { n: 10, title: 'Plan', text: 'İş parçalara bölünüyor. Her parçanın bir sahibi var.', nominalS: 6, minS: 5, enter: ev('step-start', 'c-dm'), office: ['09:12', '09:14'] },
  { n: 11, title: 'Kodlama', text: 'Dört mühendis, dört dal, tek ürün.', nominalS: 16.5, minS: 16.5, enter: ev('step-start', 'b-api'), office: ['10:50', '11:00'] },
  { n: 12, title: 'Ar-Ge', text: 'Ar-Ge tahtasında yarının fikirleri.', nominalS: 7, minS: 7, enter: { kind: 'after', seconds: 16.5 }, shots: [[0, place('rnd')]], office: ['11:00', '11:05'] },
  { n: 13, title: 'Mola', text: 'Kahve, koşu bandı, beş dakika nefes.', nominalS: 7.5, minS: 7.5, enter: { kind: 'after', seconds: 7 }, shots: [[0, place('gym')]], office: ['12:30', '12:50'] },
  { n: 14, title: 'QA', text: 'QA kodu bilerek bozuyor. Hata size ulaşmadan yakalanıyor.', nominalS: 7, minS: 6.5, enter: ev('step-start', 'c-qa'), office: ['13:30', '13:35'] },
  { n: 15, title: 'Güvenlik ve denetim', text: 'Kodu yazan onaylamaz. Güvenlik ve denetim ayrı ekipte.', nominalS: 7, minS: 6, enter: ev('step-start', 'c-as'), office: ['13:35', '13:40'] },
  { n: 16, title: 'İletişim', text: 'Kılavuz ve tanıtım metni ürünle birlikte hazır.', nominalS: 6, minS: 5, enter: ev('call', 'comms'), office: ['13:40', '13:45'] },
  { n: 17, title: 'Teslim', text: 'Söz değil, kanıt: testler yeşil, denetim temiz.', nominalS: 7, minS: 6.5, enter: ev('step-start', 'c-ceo'), office: ['13:45', '13:50'] },
  { n: 18, title: 'Kapanış', text: 'Yazılım Evi. Fikri siz getirin, gerisi kanıtıyla gelir.', nominalS: 7.5, minS: 7.5, enter: ev('step-start', 'c-ev'), shots: [[0, place('finale')]], office: ['17:20', '17:50'] },
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
  { scene: 2, speaker: 'staff:guard-desk', who: 'Güvenlik → CEO', text: 'Günaydın! Asansörünüz hazır.', cue: at(2, 0.4) },
  { scene: 2, speaker: 'ceo', who: 'CEO → Güvenlik', text: 'Günaydın. Bugün ekibe uçan bir iş getirdim.', cue: at(2, 1.4) },
  { scene: 2, speaker: 'chief-of-staff', who: 'Chief of Staff → CEO (penthouse, yeni)', text: 'Hoş geldiniz! Kahveniz masada, ekip hazır.', cue: at(2, 4.0) },
  { scene: 2, speaker: 'product-manager', who: 'Ürün Yöneticisi → CEO (penthouse, yeni)', text: 'Günaydın! O zarf epey dolu görünüyor.', cue: at(2, 4.6) },
  { scene: 2, speaker: 'delivery-manager', who: 'Teslimat Yöneticisi → CEO (penthouse, yeni)', text: 'Hoş geldiniz. Takvimde yer açtım bile.', cue: at(2, 6.6) },
  { scene: 3, speaker: 'ceo', who: 'CEO → Chief of Staff', text: 'Dronla teslimat. Her uçuş canlı izlenecek.', cue: at(3, 0.4) },
  { scene: 3, speaker: 'chief-of-staff', who: 'Chief of Staff → CEO', text: 'Bu iş herkese dokunuyor. Tüm ekibi çağırıyorum.', cue: at(3, 2.6) },
  { scene: 4, speaker: 'product-manager', who: 'Ürün Yöneticisi → Keşifçi', text: 'Müşteri paketini haritada canlı görmek istiyor.', cue: on('step-start', 'mkt', 0.8) },
  { scene: 4, speaker: 'scout', who: 'Keşifçi → Ürün Yöneticisi', text: 'Rota motorunun hazırı var, sıfırdan yazmayalım.', cue: on('step-start', 'scan', 0.8) },
  { scene: 5, speaker: 'software-architect', who: 'Yazılım Mimarı → Mimari Kurul', text: 'Tek API. Web, mobil ve dronlar aynı kapıdan.', cue: on('step-start', 'design', 0.8) },
  { scene: 5, speaker: 'architecture-board', who: 'Mimari Kurul → Yazılım Mimarı', text: 'Canlı veri için yeni kütüphane mi? Gerekçeni getir.', cue: on('handover', 'c-ab', 0.1) },
  { scene: 6, speaker: 'business-analyst', who: 'İş Analisti → Chief of Staff', text: 'Spec hazır: 14 madde, her biri test edilebilir.', cue: on('step-start', 'spec', 1.2) },
  { scene: 7, speaker: 'spec-critic', who: 'Spec Eleştirmeni → İş Analisti', text: 'Batarya yolda biterse dron nereye iniyor?', cue: on('handover', 'g-sc', 0.3) },
  { scene: 7, speaker: 'appsec', who: 'AppSec → İş Analisti', text: 'Biri dronun komutunu ele geçirirse ne olur?', cue: on('handover', 'g-as', 0.3) },
  { scene: 8, speaker: 'business-analyst', who: 'İş Analisti → Spec Eleştirmeni', text: 'Acil iniş noktalarını ekledim, testini de yazdım.', cue: on('step-end', 'rework', 0) },
  { scene: 8, speaker: 'spec-critic', who: 'Spec Eleştirmeni → İş Analisti', text: 'Tamam. Artık açık göremiyorum.', cue: on('step-end', 'g-sc', 0, 2) },
  { scene: 9, speaker: 'ceo', who: 'CEO → Chief of Staff', text: 'Okudum, imzaladım. Hadi bakalım.', cue: on('sign', 'sign', 0) },
  { scene: 10, speaker: 'delivery-manager', who: 'Teslimat Yöneticisi → Mühendisler', text: 'Dört parça, dört sahip. İlk iş testler.', cue: on('step-start', 'plan', 0.8) },
  { scene: 11, speaker: 'react-engineer', who: 'React Mühendisi → .NET Mühendisi', text: 'Canlı konum servisi ne âlemde? Harita bekliyor.', cue: at(11, 1.0) },
  { scene: 11, speaker: 'dotnet-engineer', who: '.NET Mühendisi → React Mühendisi', text: 'Test yeşile dönüyor. Beş dakikaya sende.', cue: at(11, 3.6) },
  { scene: 11, speaker: 'polyglot-engineer', who: 'Çok Dilli Mühendis → React Mühendisi (yeni)', text: 'Siz konuşun, dron telemetrisi akmaya başladı.', cue: at(11, 6.2) },
  { scene: 11, speaker: 'devops-sre', who: 'DevOps → Çok Dilli Mühendis', text: 'İmaj hazır. Herkes aynı ortamda çalışıyor.', cue: at(11, 8.8) },
  { scene: 11, speaker: 'devops-sre', who: 'DevOps → Mühendisler (yeni)', text: "Kimse 'bende çalışıyordu' demesin, Docker'da dene.", cue: at(11, 11.4) },
  { scene: 11, speaker: 'react-engineer', who: 'React Mühendisi → DevOps (yeni)', text: 'Tamam tamam, kahveler benden.', cue: at(11, 14.0) },
  { scene: 12, speaker: 'here', who: 'Ar-Ge lideri → ekip', text: 'Ya rüzgârı tahmin edip rotayı önceden çizsek?', cue: at(12, 1.0) },
  { scene: 13, speaker: 'staff:tea', who: 'Çaycı → Mühendis', text: 'Çaylar taze, demini ben bilirim.', cue: at(13, 0.6) },
  { scene: 13, speaker: 'here', who: 'Mühendis → Mühendis', text: 'Son set. Sonra harita ekranına dönüyorum.', cue: at(13, 3.2) },
  { scene: 14, speaker: 'qa-engineer', who: 'QA Mühendisi → .NET Mühendisi', text: 'İki drona aynı rotayı verdim, sistem kabul etti!', cue: on('step-end', 'test', 0, 1) },
  { scene: 14, speaker: 'dotnet-engineer', who: '.NET Mühendisi → QA Mühendisi', text: 'Haklısın, kilidi ekledim. Bir daha dene.', cue: on('step-end', 'fix', 0) },
  { scene: 14, speaker: 'qa-engineer', who: 'QA Mühendisi → .NET Mühendisi', text: 'Yeşil. Ama gözüm üstünde.', cue: on('step-end', 'test', 0, 2) },
  { scene: 15, speaker: 'appsec', who: 'AppSec → İç Denetçi', text: 'Komutlar imzalı, kodda tek bir sır yok.', cue: on('step-start', 'rev-as', 0.6) },
  { scene: 15, speaker: 'internal-auditor', who: 'İç Denetçi → Kalite Ofisi', text: '14 madde, 14 kanıt. Eksik yok.', cue: on('step-start', 'rev-ia', 0.6) },
  { scene: 16, speaker: 'marketing', who: 'Pazarlama → Teknik İletişim', text: 'Slogan: Paketin gökte, gözün haritada.', cue: on('step-start', 'w-mk', 0.8) },
  { scene: 17, speaker: 'chief-of-staff', who: 'Chief of Staff → CEO', text: 'Testler yeşil, denetim temiz. Kanıtlar ekte.', cue: on('handover', 'c-ceo', 0) },
  { scene: 17, speaker: 'ceo', who: 'CEO → herkes', text: 'Teslim edelim. Ellerinize sağlık!', cue: on('step-start', 'accept', 1.2) },
];

/** Scripted outcomes: the spec critic sends the spec back once (↺), QA goes red once, then green. */
export const FILM_OUTCOMES = { 'g-sc': ['reject', 'pass'], 'g-as': ['pass', 'pass'], 'g-ab': ['pass', 'pass'], test: ['reject', 'pass'] } as const;

/**
 * Film speed multipliers (CEO film review "hızı da biraz düşür"): walks, waits and the arrival 6×, desk work 3×, key
 * moments and the director's place shots 1× (real time).
 */
export const FILM_SPEED = { walk: 6, work: 3, key: 1 } as const;

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
