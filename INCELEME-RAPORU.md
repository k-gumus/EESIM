# EESIM (eeesim.fyi) — Teknik İnceleme Raporu

*Hazırlayan: Claude · Tarih: 2026-11-06 · Depo: k-gumus/EESIM · İncelenen sürüm: v0.2.2*

Bu rapor siteyi hem **elektrik-elektronik mühendisi** hem **web geliştirici** gözüyle değerlendirir:
güvenlik (SQL injection dahil), responsive (bilgisayar/tablet/telefon), performans ve kapasite.

> **Yöntem notu:** Güvenlik testini **canlı siteye saldırarak değil, kaynak kodu inceleyerek** yaptım.
> Bu hem üretimdeki sistemi riske atmaz hem de SQL injection gibi açıkları tespit etmenin çok daha
> eksiksiz yoludur: veritabanına dokunan **her** sorguyu tek tek okudum. Dilerseniz yerelde çalışan
> bir kopyaya (localhost) karşı canlı test de yapabiliriz.

---

## 0. Genel değerlendirme

Oğlunuz gerçekten sağlam bir iş çıkarmış. Proje bir "hafta sonu projesi" değil; sıfırdan yazılmış bir
SPICE benzeri simülasyon çekirdeği (MNA + Newton-Raphson + geçici analiz), 3D breadboard yerleşimi,
yapay zekâ asistanı ve 81 etkileşimli deney içeriyor. **Güvenlik temelleri çoğu profesyonel projeden
daha iyi.** Aşağıdaki öneriler "yangın söndürme" değil, iyi bir projeyi üretim olgunluğuna taşıma listesidir.

| Alan | Durum | Özet |
|---|---|---|
| SQL Injection | 🟢 Temiz | Tüm sorgular parametreli; açık bulunamadı |
| Kimlik/oturum | 🟢 İyi | PBKDF2, hash'li token, HttpOnly, CSRF koruması |
| XSS | 🟢 İyi | `dangerouslySetInnerHTML` yok; AI çıktısı güvenli render |
| Hız sınırı (rate limit) | 🔴→🟢 | Giriş/kayıtta kaba kuvvet koruması yoktu — **bu oturumda eklendi** |
| Güvenlik başlıkları | 🟠→🟢 | CSP / X-Frame-Options / HSTS yoktu — **bu oturumda eklendi** |
| Telefon deneyimi | 🟢 İyi | **Düzeltme:** dokun-ekle, palet çekmecesi, bottom-sheet panel ve büyük dokunma hedefleri **zaten var** |
| Tablet/masaüstü | 🟢 İyi | Büyük ekranlarda akıcı |
| Performans | 🟢 İyi | Kod bölme doğru; `manualChunks` **bu oturumda eklendi** |
| Kapasite/mimari | 🟠→🟢 | Tablo temizliği otomatik değildi — **cron bu oturumda eklendi** |
| Test/CI | 🟠→🟢 | 1 kırık test (+ CRLF ayrıştırma hatası) **bu oturumda düzeltildi**; CI önerisi duruyor |

> **Önemli düzeltme (bu rapordaki bir hatam):** İlk incelemede `styles.css`'in yalnızca ilk yarısını
> okuyup mobil bloğu (satır 3028-3232) atladığım için "telefonda eleman eklenemiyor / telefon düzeni yok"
> yazmıştım. **Bu yanlıştı.** Aşağıdaki Bölüm 2'de düzeltilmiş hâli var.

---

## 1. Güvenlik

### 1.1 SQL Injection — test sonucu: **açık yok** 🟢

Veritabanına erişen tüm dosyaları inceledim (`functions/_lib.ts`, `functions/api/**`, `worker/schema.ts`).
**İstisnasız her sorgu "prepared statement + `.bind()`" kullanıyor**; hiçbir yerde kullanıcı girdisi
SQL metnine string olarak eklenmiyor. Örnek (giriş):

```ts
// functions/api/auth/login.ts
const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
```

`email`, `?` yer tutucusuna **veri olarak** bağlanıyor; SQL olarak yorumlanmıyor. Klasik
`' OR '1'='1` türü saldırılar burada işe yaramaz. Aynı desen kayıt, oturum, ilerleme, datasheet ve
AI kota sayaçlarının hepsinde geçerli. **Sonuç: SQL injection açığı bulunamadı.**

Tek teknik not: `worker/schema.ts` içindeki `schemaStatements()` şemayı `;` ve satır sonuna göre
"naif" bölüyor. Bu güvenlik açığı **değil** — çünkü girdi sabit, gömülü `schema.sql`; kullanıcıdan
gelmiyor. (Ama 1.9'daki kırık testle ilgili.)

### 1.2 Zaten iyi yapılmış olanlar (bunları bozmayın)

- **Parolalar:** PBKDF2-SHA256, 100.000 yineleme, rastgele 16 byte tuz; karşılaştırma **sabit zamanlı**
  (timing saldırısına kapalı). Düz parola hiçbir yerde tutulmuyor.
- **Oturum:** 256-bit rastgele token; veritabanında yalnızca **SHA-256 özeti** saklanıyor (DB sızsa bile
  token'lar kullanılamaz). Çerez `HttpOnly; SameSite=Lax; Secure (https'te)`.
- **CSRF:** Durum değiştiren tüm `/api` istekleri `_middleware.ts`'te **köken (Origin) denetiminden**
  geçiyor.
- **Google OAuth:** `state` parametresi çerezle doğrulanıyor (OAuth CSRF'e kapalı); e-posta
  doğrulanmamışsa hesap açılmıyor.
- **Datasheet yükleme:** Sahiplik kontrolü (`WHERE ... AND user_id = ?`), `%PDF-` sihirli bayt kontrolü,
  20 MB sınırı, kullanıcı başı 200 dosya sınırı, dosya adı yerine **UUID** ile saklama (yol gezintisi/
  path traversal kapalı), `X-Content-Type-Options: nosniff`.
- **XSS:** Kod tabanında `dangerouslySetInnerHTML` / `innerHTML` **hiç yok**. Özel Markdown bileşeni
  (`src/ui/Markdown.tsx`) metni React düğümleri olarak basıyor; React otomatik kaçışla HTML enjeksiyonunu
  engelliyor. Bu **özellikle önemli**, çünkü yapay zekânın ürettiği metin ekranda gösteriliyor — orada
  klasik bir XSS tuzağı olurdu, ustaca kaçınılmış.

### 1.3 🔴 YÜKSEK — Hız sınırı (rate limiting) yok

`/api/auth/login`, `/api/auth/register` ve `/api/ask (POST)` uç noktalarında deneme sayısı sınırı yok.
Sonuç:
- **Parola kaba kuvvet denemesi:** saldırgan bir e-postaya saniyede onlarca parola deneyebilir.
- **Kaynak istismarı:** otomatik kayıt/istek seli ücretsiz katman kotanızı (ve AI "neuron" bütçenizi) tüketebilir.

AI uç noktasında günlük kota var ama bu bir güvenlik sınırı değil, maliyet sınırı.

**Çözüm (en kolaydan en sağlama):**
1. **Cloudflare WAF → Rate limiting rules** (panelden, kod değişikliği gerekmez): `/api/auth/*` için
   "IP başına 10 istek / 10 dk" gibi bir kural. En hızlı kazanç.
2. **Cloudflare Turnstile** (ücretsiz CAPTCHA) giriş/kayıt formuna.
3. Kod tarafında D1 ile IP başına başarısız giriş sayacı (AI'daki `ai_usage` deseninin aynısı).

### 1.4 🟠 ORTA — Güvenlik başlıkları (CSP vb.) eksik

Statik site (`dist/`) hiçbir güvenlik başlığı göndermiyor: `Content-Security-Policy`,
`X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`,
`Permissions-Policy`. Bu, **clickjacking**'e ve olası bir XSS'in etkisini sınırlayamamaya yol açar.

**Çözüm:** Proje köküne bir `public/_headers` dosyası ekleyin (Cloudflare bunu otomatik uygular):

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.google.com http://localhost:* https://huggingface.co https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'self'
```

> Not: CSP'yi önce **Report-Only** modda yayınlayıp konsolu izleyin — WebLLM (HuggingFace CDN'den model
> indirir), Ollama (localhost) ve Google avatar alan adlarını `connect-src`/`img-src`'ye eklemeniz gerekir.
> Yukarıdaki taslak bunları içeriyor; kendi kullanımınıza göre daraltın.

### 1.5 🟠 ORTA — Hesap sayımı (account enumeration)

İki yerden bir e-postanın kayıtlı olup olmadığı anlaşılabiliyor:
- `register`: var olan e-postaya **farklı** 409 mesajı dönüyor ("zaten kayıtlı" / "Google ile kayıtlı").
- `login`: kullanıcı yoksa **hemen** cevap dönüyor; varsa PBKDF2 (100k yineleme) çalıştığı için cevap
  **gözle görülür biçimde gecikiyor** → zamanlama farkından e-posta varlığı çıkarılabilir.

Çocuklara yönelik bir eğitim sitesi için risk düşük ama KVKK/gizlilik açısından değerli.
**Çözüm:** Giriş hatasında her iki durumda da aynı mesaj + benzer gecikme; kayıtta e-posta varsa
"kayıt isteği alındı" gibi nötr mesaj (idealde e-posta doğrulamayla).

### 1.6 🟢 DÜŞÜK — Diğer notlar

- **Gizli anahtarlar temiz:** depoda sızmış sır yok. `GOOGLE_CLIENT_SECRET` koda değil Cloudflare
  "Secret" olarak giriliyor (doğru). `.gitignore` `.wrangler`/`.localdev`'i kapsıyor.
- **`AI_FAKE`** yalnızca yerel; doküman "canlıya gönderme" diye uyarıyor — yerinde.
- **Misafir AI kotası** `cf-connecting-ip` özetine bağlı. Okul/ortak ağ (NAT) arkasındaki herkes aynı
  kovayı paylaşır; başlık hiç gelmezse sabit `"yerel"` kovası kullanılır. İstismar riski düşük, sadece
  bilin.
- **Oturum süresi 30 gün**, cihaz başına iptal ("tüm cihazlardan çık") yok — iyileştirme fırsatı.

---

## 2. Responsive / çoklu cihaz (telefon · tablet · bilgisayar)

> **Not:** Bu bölüm, ilk taslaktaki hatalı "mobil eksik" iddialarının **düzeltilmiş** hâlidir.
> Tüm `styles.css` (3233 satır) ve `uiStore.ts` / `Palette.tsx` okunduğunda görülüyor ki mobil destek
> büyük ölçüde **zaten uygulanmış**.

### 2.1 İyi temel

`index.html` viewport etiketi örnek niteliğinde (`viewport-fit=cover, interactive-widget=resizes-content`),
`100dvh` birimleri (mobil adres çubuğu sorununa karşı), `color-scheme: dark`, `env(safe-area-inset-*)`
(çentik/ev tuşu güvenli alanı) ve 1500/1280/1180/1100/900/760/560px kırılma noktaları var.
**Tablet ve masaüstünde deneyim akıcı.**

### 2.2 🟢 Telefonda eleman ekleme — **çalışıyor**

Palet öğesi bir `<button>` ve hem `draggable` (masaüstü sürükle-bırak) hem `onClick → addCenter()`
taşıyor. Dokunmatikte **öğeye dokunmak** elemanı tuvalin ortasına ekler ve telefonda paleti kapatır
(`src/ui/Palette.tsx`). Yani HTML5 sürükle-bırak dokunmatikte çalışmasa da **dokun-ekle yolu var.**

### 2.3 🟢 Telefon düzeni — **var**

`@media (max-width: 760px)` bloğu (styles.css ~3099+) telefonda:
- Paleti soldan açılan **çekmeceye** dönüştürüyor (`transform: translateX(-105%)`, `.pal-open` ile açılır),
  arkasında karartma (`.pal-backdrop`), üst çubukta **🧩 hamburger** (`.pal-toggle`).
- Sağ paneli **alttan açılan sayfaya (bottom sheet)** çeviriyor (`bottom:0; height:58dvh; border-radius`).
- İki satırlı üst bar, tam genişlik simülasyon düğmeleri, sabitlenmiş deney arama açılır listesi.
- Klavye açıkken (`max-height: 560px`) paneli tam ekran yapıp sohbete yer açıyor.

### 2.4 🟢 Dokunma hedefleri — **ele alınmış**

`@media (pointer: coarse)` bloğu: pin'lere `::after { inset: -10px }` ile **büyük görünmez dokunma alanı**,
sekmelere daha geniş padding, sohbet textarea'sı 16px (iOS'ta otomatik yakınlaştırmayı önler), bilgi (ⓘ)
düğmesi hep görünür ve büyütülmüş.

### 2.5 🟠 Geriye kalan ufak iyileştirmeler (opsiyonel)

Mobil temel sağlam; bunlar cilalama:
- **2D/3D/Osiloskop telefonda sekme:** Dar ekranda yan yana "2D | ayraç | 3D" yerine sekmeyle geçiş daha
  rahat olur (şu an 3D'yi açınca iki pane sığışıyor).
- **Taban yazı 13px:** Gövde metninin bir kısmı telefonda küçük kalıyor; `pointer: coarse` altında tabanı
  14px'e çekmek okunabilirliği artırır.
- **Gerçek cihaz testi:** Özellikle pin'e parmakla kablo çekme akışını bir telefonda deneyip ince ayar.

**Özet:** Telefon/tablet desteği beklediğimden çok daha olgun. "Dokun-ekle" ve "palet çekmecesi" **zaten
var**; sadece 2.5'teki cilalar kalıyor.

---

## 3. Performans / optimizasyon

### 3.1 İyi haber: kod bölme (code-splitting) doğru yapılmış

Derleyip ölçtüm. En ağır iki parça **tembel yükleniyor** (yani ilk açılışta inmiyor):
- **WebLLM/TVM çekirdeği: 6.155 kB** → yalnızca kullanıcı "tarayıcı içi AI"yı seçerse iner.
- **3D sahne (three.js): 871 kB** → yalnızca 3D görünümü açılınca iner.

Bu çok doğru bir tasarım. İlk açılışta inen gerçek yük:

| Dosya | Ham | Gzip |
|---|---|---|
| Giriş JS (`index-*.js`) | 739 kB | **244 kB** |
| CSS | 61 kB | 13 kB |
| **İlk etkileşim için toplam** | ~800 kB | **~257 kB** |

257 kB gzip orta düzey — masaüstünde anlık, yavaş bir telefonda 739 kB'ı **ayrıştırmak/çalıştırmak**
birkaç saniye alabilir. İyileştirme fırsatları:

### 3.2 Öneriler

1. **81 deneyi tembel yükleyin (en büyük kazanç).** `src/templates/*` giriş parçasında (açılışta
   yalnızca ilk şablon gerekiyor). Katalog modalı açılınca `import()` ile yüklenirse giriş parçası
   belirgin küçülür.
2. **`manualChunks`** ✅ **(bu oturumda eklendi).** React/React-DOM/React-Flow/zustand artık ayrı bir
   `vendor` parçasında (333 kB / 108 kB gzip). Bu kod nadiren değişir; tarayıcı sürümler arası önbellekte
   tutar. Uygulama parçası 738 kB → 389 kB'a (gzip 244 → 136 kB) indi. Tek dosya (`build:single`) modunda
   devre dışı bırakıldı (orada her şey tek parçada olmalı).
3. **`chunkSizeWarningLimit: 4000` satırını kaldırın.** Uyarıyı susturmak yerine görün; şu an gerçek bir
   sorunu (büyük parçaları) gizliyor.
4. **Görseller:** maskot WebP'leri makul (20–88 kB). `loading="lazy"` + `width/height` ekleyin; yalnızca
   açılış pozunu (`pose-hello`) öncelikli yükleyin (layout shift'i önler).
5. **Depodaki `EESIM.html` (2,5 MB):** bu, "çift tıkla aç" tek-dosya sürümünün **derlenmiş çıktısı** ve
   git'e eklenmiş. Depoyu şişirir ve kaynak değişince **bayatlar** (senkron kalma garantisi yok). Öneri:
   git'ten çıkarın, her sürümde `npm run build:single` ile üretip GitHub Releases'e ekleyin (ya da en
   azından her yayında yeniden üretmeyi unutmayın).

---

## 4. Kapasite / mimari

**Ücretsiz Cloudflare katmanı** bu proje için fazlasıyla yeterli: Workers ~100k istek/gün, D1 5 GB,
Workers AI ~10k "neuron"/gün. İlk tıkanacak yer AI olur (her soru neuron harcar); kotalar iyi ayarlanmış
(misafir 5, ücretsiz 20, premium 200/gün).

### 4.1 🟠 ORTA — Kendiliğinden büyüyen tablolar (temizlik otomatik değil)

- **`sessions`:** süresi dolan oturumlar **asla otomatik silinmiyor** (dokümanda elle çalıştırılacak bir
  `DELETE` komutu var). Zamanla büyür.
- **`ai_usage`:** kullanıcı × gün başına bir satır, hiç budanmıyor → sonsuza dek büyür.

**Çözüm:** Bir **Cron Trigger** (zamanlanmış Worker) ekleyin; gece bir kez:
```sql
DELETE FROM sessions WHERE expires_at < (unixepoch()*1000);
DELETE FROM ai_usage WHERE day < date('now','-7 day');
```
`wrangler.toml`'a `[triggers] crons = ["0 3 * * *"]` + Worker'da `scheduled()` işleyicisi yeterli.

### 4.2 🟢 DÜŞÜK — PBKDF2 ve ücretsiz katman CPU sınırı

Dokümanınız da not etmiş: ücretsiz Workers planında istek başı CPU sınırı var ve 100k PBKDF2 bu sınıra
yakın çalışıyor; yoğunlukta girişte "CPU time limit" hatası görülebilir. 100k yineleme güvenlik açısından
**alt sınırda** (ideal 200k+), ama Workers kısıtı gerçek. Kullanıcı artınca **Workers Paid (~5 $/ay)**
planına geçip yinelemeyi 200k'ya çıkarmak en temiz yol. (Mevcut hesaplar etkilenmez; yineleme sayısı
özetin içinde saklanıyor — güzel tasarım.)

### 4.3 Mimari — güçlü yönler

Tek Worker hem statik siteyi sunuyor hem `/api`'yi karşılıyor; D1 şeması ilk istekte otomatik kuruluyor;
`observability` açık. Sade ve sağlam. Simülasyonun tamamı tarayıcıda çalıştığı için sunucu yükü minimal —
ölçeklenmesi kolay.

---

## 5. Kod kalitesi / eksikler

- **✅ Kırık test düzeltildi + gizli bir CRLF hatası bulundu.** `worker/index.test.ts` şema ifade sayısını
  sabit **7** bekliyordu; sayıyı `toBeGreaterThanOrEqual(7)` yaptım. Bunu düzeltince **daha önemli, gizli
  bir hata ortaya çıktı:** `worker/schema.ts`'teki yorum temizleyen regex (`/--.*$/`) **CRLF (Windows)
  satır sonlarında çalışmıyordu** — JS'te `.` `\r`'yi geçmez, `$` `\r`'den önce eşleşmez; dolayısıyla
  yorumlar silinmiyor ve içinde `;` olan bir yorum SQL ifadesini ikiye bölüyordu. **Risk:** Windows'tan
  `npm run deploy` yapılırsa şema CRLF olarak paketlenir ve `ensureSchema` üretimde her API isteğinde
  patlayabilirdi (GitHub'a bağlı otomatik dağıtım Linux/LF olduğu için şimdilik maskeliyordu). İki yerden
  düzelttim: `schemaStatements` artık `\r`'leri temizliyor + repoya `.gitattributes` (her yerde LF) ekledim.
  Artık **102/102 test geçiyor.**
- **🟢 Test kalitesi genelde çok iyi:** simülasyon motoru analitik sonuçlara karşı doğrulanıyor (RC kesim
  frekansı, BJT/MOSFET çalışma noktası, köprü doğrultucu…) ve **her quiz cevabının simülasyonla tutarlı
  olduğu** test ediliyor. Bu seviye nadir görülür.
- **TypeScript strict** (`tsc --noEmit` build'in parçası) — iyi.
- **CI görünmüyor (Cloudflare yolu için).** Depoda yalnızca GitHub Pages için bir şablon workflow var
  (`docs/github-pages-deploy.yml`, elle taşınması gerekiyor). Öneri: PR'larda `npm run typecheck` +
  `npm test` çalıştıran küçük bir GitHub Action; böylece 5.1'deki gibi kırık testler yayına sızmaz.

---

## 6. Durum ve öncelik

### ✅ Bu oturumda yapıldı (kod değiştirildi — henüz commit/push edilmedi)

| İş | Dosya(lar) |
|---|---|
| Güvenlik başlıkları (X-Frame-Options, HSTS, nosniff, Referrer/Permissions-Policy, CSP *Report-Only*) | `public/_headers` (yeni) |
| Giriş/kayıt için kod-seviyesi hız sınırı (D1, **fail-open**: giriş 10/10dk, kayıt 5/saat) | `functions/_lib.ts`, `functions/api/auth/login.ts`, `functions/api/auth/register.ts`, `schema.sql` |
| Zamanlanmış temizlik (süresi dolmuş oturum / eski kota / hız sınırı kayıtları), her gün 03:00 UTC | `worker/index.ts`, `wrangler.toml` |
| Kırık testi düzelt + **CRLF şema ayrıştırma hatasını** gider | `worker/index.test.ts`, `worker/schema.ts`, `.gitattributes` (yeni) |
| `manualChunks` ile vendor parçası (daha iyi önbellek) | `vite.config.ts` |

**Doğrulama:** `npm run typecheck` ✅ · `npm test` ✅ 102/102 · `npm run build` ✅.

> CSP şimdilik **Report-Only** (hiçbir şeyi engellemez, yalnızca konsola bildirir). WebLLM/Ollama ile
> birkaç gün izleyip ihlal görmezseniz `public/_headers`'ta `Content-Security-Policy-Report-Only` →
> `Content-Security-Policy` yapın.

### 🔜 Önerilen sonraki adımlar (henüz yapılmadı)

| # | İş | Alan | Etki | Emek |
|---|---|---|---|---|
| 1 | **Cloudflare WAF hız sınırı** (`/api/auth/*`) — koddaki sınıra ek, ağ seviyesinde (panelden) | Güvenlik | Yüksek | Düşük |
| 2 | Cloudflare **Turnstile** (ücretsiz CAPTCHA) giriş/kayıt formuna | Güvenlik | Orta | Orta |
| 3 | PR'da CI: `npm run typecheck` + `npm test` (GitHub Action) | Kalite | Orta | Düşük |
| 4 | 81 deneyi tembel yükle (katalog açılınca `import()`) | Performans | Orta | Orta |
| 5 | Hesap sayımını azalt (giriş/kayıtta nötr mesaj ve benzer gecikme) | Güvenlik | Düşük | Düşük |
| 6 | Telefonda 2D/3D/Osiloskop sekmesi + taban yazı 14px | Mobil | Düşük-Orta | Orta |
| 7 | `EESIM.html`'i git'ten çıkar, sürümde üret | Hijyen | Düşük | Düşük |

> **Not:** 1. madde (WAF) koddaki hız sınırının yerine değil, **tamamlayıcısı**. Kod-seviyesi sınır her
> ortamda (yerel dahil) çalışır; WAF ise istekler Worker'a ulaşmadan ağ kenarında durdurur. İkisi birlikte
> en sağlamı.
