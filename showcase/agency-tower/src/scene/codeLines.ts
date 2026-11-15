// Built-in placeholder text for desk screens (REQ-21). Never repository content.
export const CODE_LINES: readonly string[] = [
  'const floors = buildFloors(6);',
  'for (const unit of roster) {',
  '  desk.assign(unit);',
  '}',
  'function ride(from, to) {',
  '  return ease(from, to, 0.8);',
  '}',
  'export type Tier = "lead";',
  'if (state === "work") type();',
  'await coffee.pour(cup);',
  'const ok = tests.every(pass);',
  'render(scene, camera);',
  'queue.push({ id, floor });',
  'let phase = 0.25;',
  'import { Mesh } from "three";',
  'return units.filter(isIdle);',
  'while (!done) { step(dt); }',
  'log("tower ready");',
  'const lift = new Cabin(0);',
  'lift.open();',
  'type Pose = "idle" | "walk";',
  'const seed = 20261113;',
  'map.set(unit.id, desk);',
  'robot.wave();',
];

// ---------------------------------------------------------------- software-company screens (KARARLAR Rev 35)
// Built-in, fictional placeholder content only: never repository content, real products or real people.

/** What a floor's desk screens show: engineering code, QA/security test and scan lists, product specs and diagrams, management plans. */
export type ScreenDomain = 'engineering' | 'quality' | 'product' | 'management';

/** Floor -> desk screen domain (0 lobby and 3 strategy/architecture: product; 4 management and 5 CEO: management). */
export function screenDomain(floor: number): ScreenDomain {
  if (floor === 1) return 'engineering';
  if (floor === 2) return 'quality';
  if (floor >= 4) return 'management';
  return 'product';
}

// Rows start with a status marker the screen painter draws as an icon (shape + colour): '✓ ' pass,
// '✗ ' fail, '! ' warning, '▶ ' running, '# ' heading. A trailing ' NN%' is drawn as a progress bar.
const QUALITY_LINES: readonly string[] = [
  '# Test koşusu · #482',
  '✓ giriş akışı · 12 test',
  '✓ sepet hesabı · 31 test',
  '✓ fatura PDF · 8 test',
  '✗ iade akışı · 1 hata',
  '✓ arama filtresi · 17 test',
  '▶ uçtan uca · 4/9',
  '✓ erişilebilirlik · 22 test',
  '# Zafiyet taraması',
  '✓ bağımlılıklar · temiz',
  '! oturum çerezi · orta',
  '✓ gizli anahtar · yok',
  '✓ SQL enjeksiyon · yok',
  '! CSP başlığı · düşük',
  '✓ XSS · yok',
  '✓ TLS ayarı · A+',
  '# Kapsam',
  'birim testleri 86%',
  'entegrasyon 72%',
  'uçtan uca 58%',
  '# Kalite kapısı',
  '✓ lint · 0 uyarı',
  '✓ tip kontrolü · temiz',
  '▶ performans · ölçülüyor',
];

const PRODUCT_LINES: readonly string[] = [
  '# Spec 0042 · Ödeme v2',
  'Amaç: tek adımda ödeme',
  '# Kabul kriterleri',
  '✓ kartla ödeme 3 sn altında',
  '✓ hata mesajı Türkçe',
  '▶ iade 2 iş günü içinde',
  '! taksit seçeneği · açık soru',
  '# Akış',
  'Sepet -> Ödeme -> Onay',
  'Onay -> Fatura -> E-posta',
  '# Bileşenler',
  'web istemci · API · kuyruk',
  'ödeme servisi · veritabanı',
  '# Mimari kararlar',
  'ADR-12 kuyruk ile ayrıştır',
  'ADR-13 idempotent istek',
  '# Riskler',
  '! dış sağlayıcı gecikmesi',
  '✓ veri kaybı yok · yedekli',
  '# Kapsam dışı',
  'çoklu para birimi',
  '# İlerleme',
  'tasarım 90%',
  'spec onayı 100%',
];

const MANAGEMENT_LINES: readonly string[] = [
  '# Yol haritası · Q4',
  'Ödeme v2 75%',
  'Mobil uygulama 40%',
  'Raporlama 90%',
  'Arama 2.0 20%',
  '# Sprint 23 · burndown',
  'kalan iş 34 puan',
  'tamamlanan 21 puan',
  '✓ hedefte · 3 gün kaldı',
  '# KPI',
  'müşteri memnuniyeti 92%',
  'zamanında teslim 88%',
  'hata kaçağı 3%',
  'altyapı kullanımı 64%',
  '# Sürümler',
  '✓ v2.3 · yayında',
  '▶ v2.4 · staging',
  '! v2.5 · kapsam riski',
  '# Ekip',
  'kapasite 85%',
  'izin · 1 kişi',
  '# Kararlar',
  '✓ bütçe onaylı',
  '▶ işe alım · 2 rol',
];

/** Scrolling content of the main desk screen, per domain; every list has CODE_LINES.length rows. */
export const SCREEN_LINES: Readonly<Record<ScreenDomain, readonly string[]>> = {
  engineering: CODE_LINES,
  quality: QUALITY_LINES,
  product: PRODUCT_LINES,
  management: MANAGEMENT_LINES,
};

/** Right-hand pane of the main screen (visible in full on ultrawide monitors): terminal, scan summary, notes, metrics. */
export const SIDE_PANE_LINES: Readonly<Record<ScreenDomain, readonly string[]>> = {
  engineering: ['$ npm test', '✓ 128 geçti', '✓ 0 atlandı', 'süre 4.2 sn', '$ git status', 'temiz', '$ npm run build', '✓ derlendi', '$ npm run lint', '✓ 0 uyarı', '$ npm test', '✗ 1 hata', 'iade.spec', 'beklenen 200', '$ npm test', '✓ 129 geçti', '$ deploy staging', '▶ yükleniyor', '✓ staging hazır', '$ npm audit', '✓ 0 zafiyet', '$ npm test', '✓ 129 geçti', '$ _'],
  quality: ['# Önem', 'kritik 0', 'yüksek 0', 'orta 2', 'düşük 5', '# Durum', '✓ geçti 94', '✗ kaldı 1', '▶ sürüyor 5', '# Hedef', '✓ kapı açık', '# Önem', 'kritik 0', 'yüksek 0', 'orta 2', 'düşük 5', '# Son 7 gün', '✓ 41 koşu', '✗ 2 kırık', '# Hedef', '✓ kapı açık', '# Not', 'iade testi', 'yeniden dene'],
  product: ['# Notlar', 'kullanıcı: kasiyer', 'cihaz: tablet', '# Sorular', '! taksit?', '! iade limiti?', '# Kaynak', 'görüşme 4', 'anket 120', '# Öncelik', '✓ ödeme', '▶ iade', '# Notlar', 'tek ekran', 'karanlık tema', '# Ölçüt', 'dönüşüm 3%', 'hata 0.5%', '# Durum', '✓ tasarım', '▶ geliştirme', '# Sonraki', 'raporlama', 'mobil'],
  management: ['# Bütçe', 'harcanan 61%', '# Risk', '! kapsam', '✓ takvim', '# Hız', 'S21 29', 'S22 33', 'S23 31', '# Bütçe', 'harcanan 61%', '# Risk', '! kapsam', '✓ takvim', '# Gelir', 'aylık 12%', '# Hız', 'S21 29', 'S22 33', 'S23 31', '# Toplantı', '10:00 planlama', '14:00 demo', '16:30 retro'],
};

// ---------------------------------------------------------------- wall displays and signage

/** CI/CD stage status; each has its own icon shape, so status never rides on colour alone. */
export type StageStatus = 'pass' | 'fail' | 'run' | 'wait';
export const STATUS_ICON: Readonly<Record<StageStatus, 'check' | 'cross' | 'play' | 'pause'>> = { pass: 'check', fail: 'cross', run: 'play', wait: 'pause' };
export const STATUS_LABEL: Readonly<Record<StageStatus, string>> = { pass: 'geçti', fail: 'kaldı', run: 'sürüyor', wait: 'bekliyor' };

export interface PipelineRun {
  readonly label: string;
  readonly stages: readonly (readonly [string, StageStatus])[];
}
export const PIPELINE_STAGES: readonly string[] = ['Derleme', 'Test', 'Güvenlik', 'Paket', 'Staging', 'Canlı'];
export const PIPELINE_RUNS: readonly PipelineRun[] = [
  { label: '#482 ana dal', stages: [['Derleme', 'pass'], ['Test', 'pass'], ['Güvenlik', 'pass'], ['Paket', 'pass'], ['Staging', 'run'], ['Canlı', 'wait']] },
  { label: '#481 ödeme-v2', stages: [['Derleme', 'pass'], ['Test', 'fail'], ['Güvenlik', 'wait'], ['Paket', 'wait'], ['Staging', 'wait'], ['Canlı', 'wait']] },
  { label: '#480 arama', stages: [['Derleme', 'pass'], ['Test', 'pass'], ['Güvenlik', 'pass'], ['Paket', 'pass'], ['Staging', 'pass'], ['Canlı', 'pass']] },
];

export const KANBAN_COLUMNS: readonly string[] = ['YAPILACAK', 'YAPILIYOR', 'İNCELEME', 'BİTTİ'];
/** Cards per kanban column. */
export const KANBAN_CARDS: readonly number[] = [3, 2, 2, 4];

export const ONCALL = {
  title: 'NÖBET · Kalite ve Güvenlik',
  services: [['API', 'pass'], ['Ödeme', 'pass'], ['Arama', 'run'], ['Kuyruk', 'pass'], ['Bildirim', 'fail']] as readonly (readonly [string, StageStatus])[],
  uptime: 'Erişilebilirlik 99,97%',
  incidents: 'Açık olay: 1',
} as const;

export const RELEASE_CALENDAR = {
  title: 'SÜRÜM TAKVİMİ · KASIM',
  firstWeekday: 5, // 1 November falls on a Saturday (Mon = 0)
  days: 30,
  today: 14,
  releases: [[4, 'v2.3'], [18, 'v2.4'], [27, 'v2.5']] as readonly (readonly [number, string])[],
} as const;

/** Fictional brand: never a real company name or logo. */
export const BRAND = { name: 'YAZILIM EVİ', tagline: 'Yazılım Atölyesi' } as const;
export const WELCOME_LINES: readonly string[] = ['Hoş geldiniz', `${BRAND.name} · ${BRAND.tagline}`, 'Ziyaretçi kaydı resepsiyonda', 'Misafir ağı: YazilimEvi-Misafir'];
/** Fictional awards on the lobby plaques. */
export const AWARDS: readonly (readonly [string, string])[] = [
  ['Yılın Ekibi', '2025'],
  ['Temiz Kod', 'Ödülü'],
  ['365 Gün', 'Kesintisiz'],
];
