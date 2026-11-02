#!/usr/bin/env node
// humanize-check.js: mechanical check for Turkish "AI voice" and absolute claims in customer-facing text (WR-02).
//   node humanize-check.js <file.md> [more files]
// Prints HATA (absolute, unprovable claims) and UYARI (filler patterns) per line. Exit 1 only on HATA.
// A clean result proves only that these known patterns are absent, not that the text is good.
// Fenced code blocks are skipped. Zero dependencies; reads files only.
"use strict";
const fs = require("fs");

const lc = (s) => s.toLocaleLowerCase("tr");
const RULES = [
  // HATA: claims that cannot be proven
  ["HATA", /%\s?100\b|yüzde yüz/, "mutlak iddia (%100)"],
  ["HATA", /\ben iyi\b|\ben hızlı\b|\ben güvenli\b|\ben kolay\b/, "kanıtlanamaz üstünlük (en iyi/en hızlı/…)"],
  ["HATA", /\bgaranti(li|si)\b|\bsıfır risk\b|\bhiç(bir)? hata\b/, "garanti/mutlak vaat"],
  ["HATA", /\bkusursuz\b|\beşsiz\b|\bbenzersiz\b|\brakipsiz\b/, "abartılı sıfat"],
  // UYARI: filler and AI-voice patterns
  ["UYARI", /günümüzün hızla değişen|dijital çağda|teknolojinin hızla geliştiği/, "boş giriş kalıbı"],
  ["UYARI", /\bsonuç olarak\b|\bözetle\b|\bbu bağlamda\b|\bbu doğrultuda\b/, "boş geçiş/kapanış kalıbı"],
  ["UYARI", /önemli bir rol oynar|büyük önem taşır|dikkat çekmektedir|söz konusudur|göz önünde bulundurulmalıdır/, "boş kalıp"],
  ["UYARI", /devrim niteliğinde|çığır açan|hayatınızı kolaylaştır|bir adım öne çık|yeni bir boyut kazandır/, "pazarlama klişesi"],
  ["UYARI", /\bpeki\b[^.?!]{0,60}\?/, "soru-cevap taklidi"],
  ["UYARI", /sadece [^.]{3,60} değil,? aynı zamanda/, "'sadece X değil, aynı zamanda Y' kalıbı"],
  ["UYARI", /(yapılmaktadır|sağlanmaktadır|gerçekleştirilmektedir|sunulmaktadır)/, "edilgen yığılma (özne ve eylemi söyle)"],
];

function check(text) {
  const out = []; let fenced = false;
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const l = lc(line);
    for (const [level, re, why] of RULES) {
      const m = l.match(re);
      if (m) out.push({ level, line: i + 1, match: m[0], why });
    }
  });
  // emoji and long dash density
  const prose = text.replace(/```[\s\S]*?```/g, "");
  const dashes = (prose.match(/—/g) || []).length;
  if (dashes > 3 && dashes / Math.max(prose.length, 1) * 1000 > 3) out.push({ level: "UYARI", line: 0, match: "—", why: `uzun tire yoğunluğu (${dashes}); virgül, nokta veya iki nokta kullan` });
  const emoji = (prose.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emoji > 2) out.push({ level: "UYARI", line: 0, match: "emoji", why: `emoji ile süsleme (${emoji})` });
  return out;
}

module.exports = { check };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: humanize-check.js <file.md> [...]"); process.exit(2); }
  let errors = 0, warns = 0;
  for (const f of files) {
    const res = check(fs.readFileSync(f, "utf8"));
    for (const r of res) { console.log(`${r.level}  ${f}:${r.line}  "${r.match}"  ${r.why}`); if (r.level === "HATA") errors++; else warns++; }
  }
  console.log(`Yazım denetimi: ${errors ? "HATA " + errors : "HATA 0"} · UYARI ${warns} · ${errors ? "SONUÇ: DÜZELT" : warns ? "SONUÇ: UYARILARI GÖZDEN GEÇİR" : "SONUÇ: TEMİZ"}`);
  process.exit(errors ? 1 : 0);
}
