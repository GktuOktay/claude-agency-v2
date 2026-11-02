# Operasyon ve destek süreci (B14, OPS-01, OPS-02, ENG-11)

**Sahipleri:** olay akışında DevOps/SRE (`devops-sre`), destek triyajında Product + ana oturum. Canlı sistemlere dokunan her adım CEO onayıyla (anayasa kural 4); birimlerin canlıya erişim aracı yoktur.

## Olay akışı

```mermaid
flowchart LR
  A[Tespit<br/>izleme eşiği veya kullanıcı] --> B[Ciddiyet<br/>SEV1 SEV2 SEV3]
  B --> C[Stabilize et<br/>geri alma paketi]
  C --> D[Kanıt topla<br/>log, zaman çizelgesi]
  D --> E[Kök neden]
  E --> F[Düzelt<br/>test önce]
  F --> G[Olay raporu<br/>templates/olay-postmortem.md]
  G --> H[Ders: kılavuz, kapı, eşik<br/>Talent ve capacity'ye]
  C -. canlıya dokunan adım .-> I((CEO onayı))
```

Okuma: soldan sağa beş adım ve her olay raporla kapanır. Kesikli ok, canlıya dokunan adımın CEO onayına bağlı olduğunu gösterir.

## Ciddiyet
| Seviye | Tanım | İlk cevap |
|---|---|---|
| SEV1 | Hizmet kapalı veya veri kaybı/sızıntı şüphesi | CEO'ya hemen bildirim (masaüstü bildirimi + durum raporu), AppSec devrede |
| SEV2 | Kısmi bozulma, geçici çözüm var | Aynı gün düzeltme planı |
| SEV3 | Küçük, kullanıcıyı engellemiyor | Backlog |

## Destek triyajı

```mermaid
flowchart TD
  T[Kullanıcı talebi<br/>templates/destek-triyaj.md] --> S{Sınıf}
  S -- hata --> E[Engineering: issue<br/>önce başarısız yeniden üretim testi]
  S -- özellik isteği --> P[Product: backlog ve yol haritası]
  S -- kullanım sorusu --> D[Tech comms: kılavuza bağlantı]
  S -- güvenlik veya veri --> A[AppSec + CEO hemen]
  S -- KVKK talebi --> K[Kalite ofisi + CEO: AVUKAT GEREKİR]
```

Okuma: her talep tek sınıfa girer ve bir birime gider. Kullanıcıya giden cevap taslaktır, gönderim CEO onayıyla (dış mesaj, kural 4). Aynı sorun 3 talepte tekrarlanırsa Product'a eğilim olarak bildirilir.

## İzleme (ilk sürüm)
- Eşikler her uygulamanın deploy paketinde yazılır (`devops-sre` kılavuzu): hata oranı, yanıt süresi, disk, sertifika bitiş tarihi.
- Eşik aşımı → olay akışı başlar. Otomatik izleme aracının kurulumu uygulamaya özeldir; ilk gerçek yayında seçilir (Scout → Architecture board → CEO).
- **Bilinen sınır:** izleme ve uyarı aracı henüz yok; yalnızca süreç ve şablonlar hazır. Gerçek olayda denenmedi.

## Kanıt seviyesi (AUD-05)
Documented (süreç ve şablon). Validated: şablonların varlığı `lint.js` denetler. Enforced değil.
