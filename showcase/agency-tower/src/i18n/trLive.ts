// Turkish UI text for KARARLAR Rev 43 package C (Şirket nabzı, Olay akışı, Gün hızı, Ekran görüntüsü).
// Kept apart from tr.ts so parallel packages do not collide in one file.
export const trLive = {
  pulse: {
    tab: 'Nabız',
    title: 'Şirket nabzı',
    note: 'Simülasyon · canlı',
    jobsDone: 'Biten işler',
    jobsActive: 'Aktif işler',
    meetings: 'Yapılan toplantılar',
    breaks: 'Kahve ve molalar',
    busiest: 'En kalabalık yer',
    busiestValue: (name: string, n: number): string => `${name} (${n} kişi)`,
    nobody: 'Kimse yok',
    simTime: 'Simülasyon saati',
    simTimeValue: (office: string, s: number): string => `${office} · ${Math.floor(s / 60)} dk ${Math.floor(s % 60)} sn`,
    events: 'Son olaylar',
    noEvents: 'Henüz olay yok.',
  },
  feed: {
    label: 'Olay akışı',
    on: 'Olay akışı: açık',
    off: 'Olay akışı: kapalı',
    go: (text: string): string => `${text}: oraya git`,
  },
  day: {
    speed: 'Gün hızı',
    speedLabel: (n: number): string => `Gün hızı ${n}×`,
    lunch: 'Öğle arasına atla',
    jumped: 'Ofis saati 12:30 · öğle arası',
    already: 'Zaten öğle arası',
  },
  shot: {
    button: 'Ekran görüntüsü al',
    saved: (name: string): string => `Kaydedildi: ${name}`,
    failed: 'Ekran görüntüsü alınamadı. Tekrar deneyin.',
  },
} as const;
