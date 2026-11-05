# Otomatik yönlendirme (şirket hattı)

Kullanıcı (CEO) bir iş anlattığında ilgili birimi **sormadan** devreye al; hattı o başlatır, sen yönetirsin. Sohbet, soru, açıklama, tek satırlık düzeltme için hat açma: onları kendin yap.

| Kullanıcı ne diyor | Devreye giren |
|---|---|
| Fikir, "yapalım mı", rakip, piyasa | `product-manager`, gerekirse `scout` (hazır çözüm var mı) |
| Yeni sistem, büyük değişiklik, başka yığından göç | `software-architect` → `business-analyst` (spec) |
| Küçük iş veya hata | `business-analyst` (hızlı spec) |
| Başka yığındaki (Django, Vue, PHP, Java, Go) sistemi anlama veya taşıma | `polyglot-engineer` (envanter), tasarım için `software-architect` |
| "Hazır mı", "bitti mi", teslim | `qa-engineer` → `appsec` → `internal-auditor` → `quality-office` |
| Yayın, sunucu, Docker, CI | `devops-sre` (paketi hazırlar, çıkışı CEO yapar) |
| Mağaza metni, marka, kullanım kılavuzu, sunum | `marketing`, `tech-comms` |

**Hat (spec önce, imza sonra, kod en son):**
1. Spec yazılır (`business-analyst`; büyük işte önce `software-architect`).
2. İmzadan önce bağımsız kapılar, paralel: `spec-critic`, `appsec` (tehdit modeli), `architecture-board`, `talent-capacity`. Bulgular spec'e işlenir.
3. Spec'i yalnızca CEO imzalar. İmzasız kod yazılmaz.
4. İmzadan sonra: `delivery-manager` plan; uygulama `dotnet-engineer`, `react-engineer` veya `polyglot-engineer`; sonra 2. satırdaki teslim zinciri.
5. Yapan doğrulamaz: bir işi yazan birim onu denetlemez.

**Hatırlatma:** bitti demek için taze derleme/test çıktısı göster. Prod deploy, main'e push/merge, mağaza gönderimi, herkese açık yayın, dış mesaj, para harcama ve kalıcı silme her seferinde CEO onayıyla. Varsayılan yığın .NET + React'tır ama kısıt değildir; spec başka yığın adlandırırsa orada çalış. İmza kapısı ve guard yalnızca `harness/bin/install-project.sh` ile kurulmuş projelerde zorlanır; kurulmamış projede aynı hattı talimatla izle ve spec onayını sohbette CEO'dan al.
