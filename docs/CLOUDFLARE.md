# IEEESIM’i Cloudflare’de yayınlama

Bu rehber IEEESIM’i kendi alan adınla, **giriş sistemi**, **ilerleme kaydı**, **datasheet depolama** ve
**“Tepecan’a Sor” (Workers AI)** ile birlikte yayına almak için gereken her şeyi sırayla anlatır.
Hepsi Cloudflare’in ücretsiz katmanında çalışır; yalnızca alan adı ücretlidir.

| Parça | Cloudflare ürünü | Ne tutuyor |
|---|---|---|
| Site (React uygulaması) | **Pages** | `dist/` klasörü |
| API (`/api/*`) | **Pages Functions** | `functions/` klasörü: giriş, ilerleme, datasheet, Tepecan’a Sor |
| Veritabanı | **D1** (SQLite) | kullanıcılar, oturumlar, XP/ilerleme, datasheet listesi, AI kotası (`schema.sql`) |
| Dosyalar | **R2** | kullanıcıların yüklediği datasheet PDF’leri |
| Yapay zekâ | **Workers AI** | Tepecan’ın cevapları (Llama 3.1 8B; premium için Llama 3.3 70B) |

> Fiyat ve ücretsiz kota bilgileri değişebilir; güncel değerler için Cloudflare’in fiyat sayfalarına bak.
> Kabaca: Pages/Functions günde 100 bin istek, D1 5 GB, R2 10 GB depolama, Workers AI günde 10 000 “neuron” ücretsizdir.
> 8B modelle bu, günde birkaç yüz kısa cevaba denk gelir; kota ayarları `wrangler.toml`’da.

---

## 0. Ön hazırlık (bir kez)

```bash
npm install
npx wrangler login          # tarayıcıda Cloudflare hesabınla onay ver
```

## 1. Cloudflare hesabı ve alan adı

1. <https://dash.cloudflare.com> → hesap aç (e-posta doğrulaması).
2. **Domain Registration → Register Domains** → alan adını ara ve satın al
   (Cloudflare Registrar maliyet fiyatına satar, yıllık yenilenir). Alan adı otomatik olarak Cloudflare DNS’ine eklenir.
   - Alan adını başka bir yerden aldıysan: **Add a site** → alan adını yaz → Free plan → verilen iki nameserver’ı
     alan adını aldığın yerde gir.

## 2. Veritabanı (D1)

```bash
npx wrangler d1 create ieeesim
```

Çıktıdaki `database_id` değerini `wrangler.toml` içindeki `BURAYA-D1-KIMLIGI` yerine yapıştır. Sonra tabloları oluştur:

```bash
npm run db:remote           # = wrangler d1 execute ieeesim --remote --file=schema.sql
```

## 3. Dosya deposu (R2)

1. Dashboard → **R2 Object Storage** → ilk kullanımda R2’yi etkinleştir (ücretsiz katman için de kart bilgisi isteyebilir).
2. Kova oluştur:

```bash
npx wrangler r2 bucket create ieeesim-files
```

Kova adı `wrangler.toml`’daki `bucket_name` ile aynı olmalı. Kova **herkese açık yapılmaz**; PDF’ler yalnızca sahibine `/api/datasheets/<id>` üzerinden verilir.

## 4. Workers AI

Ek kurulum gerekmez: `wrangler.toml`’daki `[ai] binding = "AI"` satırı yeter. İlk istekte hesabında Workers AI otomatik açılır.
Model değiştirmek için `AI_MODEL` / `AI_MODEL_PREMIUM` değişkenlerini düzenle (Workers AI model kataloğundaki
`@cf/...` adlarından biri). Türkçe cevap kalitesi önemliyse büyük modelleri dene.

## 5. Google ile giriş (OAuth istemcisi)

1. <https://console.cloud.google.com> → yeni proje (ör. “IEEESIM”).
2. **APIs & Services → OAuth consent screen** (yeni arayüzde “Google Auth Platform”):
   - Uygulama adı: IEEESIM · destek e-postası: senin adresin · kullanıcı türü: **External**
   - Kapsamlar (scopes): `openid`, `email`, `profile` (hassas kapsam değildir, Google incelemesi gerekmez)
   - Test aşamasında en fazla 100 test kullanıcısı girebilir; herkese açmak için **Publish app** de.
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - **Authorized JavaScript origins:** `https://ALAN-ADIN` (ve test için `https://ieeesim.pages.dev`)
   - **Authorized redirect URIs:** `https://ALAN-ADIN/api/auth/google/callback`
     (ve `https://ieeesim.pages.dev/api/auth/google/callback`)
4. Verilen **Client ID**’yi `wrangler.toml` → `GOOGLE_CLIENT_ID` değerine yaz.
5. **Client secret** gizlidir, dosyaya yazma; Pages projesi oluştuktan sonra (adım 6) şu komutla ekle:

```bash
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name ieeesim
```

`GOOGLE_CLIENT_ID` boş bırakılırsa giriş ekranında Google düğmesi devre dışı görünür; e-posta/şifre ile giriş yine çalışır.

## 6. Yayınla (Pages)

```bash
npm run deploy              # = npm run build && wrangler pages deploy dist
```

İlk çalıştırmada proje adı sorulursa `ieeesim` yaz (production branch: `main`). Site `https://ieeesim.pages.dev` adresinde açılır.
`functions/` klasörü otomatik olarak API’ye dönüşür; D1, R2 ve AI bağlantıları `wrangler.toml`’dan okunur.

> Alternatif: Pages → **Connect to Git** ile GitHub deposunu bağla (build komutu `npm run build`, çıktı `dist`).
> Bu durumda bağlantılar yine `wrangler.toml`’dan gelir; gizli anahtarı dashboard’dan **Settings → Variables and Secrets**’a ekle.

## 7. Alan adını bağla

Dashboard → **Workers & Pages → ieeesim → Custom domains → Set up a custom domain** → `ALAN-ADIN` (ya da `sim.ALAN-ADIN`).
Alan adı Cloudflare’de olduğu için DNS kaydı ve HTTPS sertifikası otomatik oluşur (birkaç dakika sürebilir).
Google OAuth’taki adreslerin bu alan adıyla birebir aynı olduğundan emin ol.

## 8. Kontrol listesi

- [ ] `https://ALAN-ADIN/api/health` → `{"ok":true,"google":true,"ai":true,"db":true,"files":true}`
- [ ] Giriş ekranında e-posta ile kayıt ol → sağ üstte adın görünüyor
- [ ] Bir deney adımını tamamla → başka tarayıcıda giriş yap → XP aynı
- [ ] Bir elemanın bilgi kartından PDF yükle → “☁ hesapta” yazıyor, tıklayınca açılıyor
- [ ] Tepecan’a Sor → cevap akıyor, başlıkta “bugün 19/20 soru” görünüyor
- [ ] Google ile giriş → hesabını seç → uygulamaya geri dönüyor

---

## Yerelde test (isteğe bağlı)

```bash
npm run db:local                                   # yerel D1 tablolarını oluştur
npm run dev:api                                    # build + wrangler pages dev → http://localhost:8788
```

`wrangler pages dev`, Workers AI için `wrangler login` gerektirir (AI her zaman Cloudflare’de çalışır).
Giriş yapmadan denemek istersen `wrangler.toml`’dan `[ai]` bölümünü geçici olarak kaldırıp `[vars]`’a `AI_FAKE = "1"` ekle:
Tepecan sahte bir cevap akıtır, kota yine sayılır. **Bu ayarı canlıya gönderme.**

Arayüz geliştirme için `npm run dev` (Vite, http://localhost:5173) yeterli; bu modda /api olmadığından uygulama “çevrimdışı sürüm” olarak açılır ve misafir modunda çalışır.

## Yönetim komutları

```bash
# Bir kullanıcıyı premium yap (daha büyük model + günde 200 soru)
npx wrangler d1 execute ieeesim --remote --command "UPDATE users SET premium = 1 WHERE email = 'ornek@yeditepe.edu.tr'"

# Kullanıcı sayısı
npx wrangler d1 execute ieeesim --remote --command "SELECT COUNT(*) FROM users"

# Bugün en çok soru soranlar
npx wrangler d1 execute ieeesim --remote --command "SELECT user_id, count FROM ai_usage WHERE day = date('now') ORDER BY count DESC LIMIT 10"

# Süresi dolmuş oturumları temizle
npx wrangler d1 execute ieeesim --remote --command "DELETE FROM sessions WHERE expires_at < unixepoch() * 1000"
```

## Güvenlik notları

- Şifreler PBKDF2-SHA256 (100 000 yineleme, rastgele tuz) ile saklanır; düz metin hiçbir yerde tutulmaz.
- Oturum çerezi `HttpOnly; Secure; SameSite=Lax`; veritabanında belirtecin yalnızca SHA-256 özeti durur → veritabanı sızsa bile oturum çalınamaz.
- Durum değiştiren tüm `/api` istekleri yalnızca sitenin kendi kökeninden kabul edilir.
- Ücretsiz Workers planında istek başına CPU süresi sınırlıdır; şifre özeti bu sınıra yakın çalışır. Girişte
  “Worker exceeded CPU time limit” hatası görürsen Workers Paid planına geç (aylık ~5 $) ya da `functions/_lib.ts`’teki `PBKDF2_ITER` değerini düşür
  (mevcut hesaplar etkilenmez, yineleme sayısı özetin içinde saklanır).
