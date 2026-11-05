# EESIM’i Cloudflare’de yayınlama

EESIM tek bir **Cloudflare Worker** olarak çalışır. Worker hem siteyi (`dist/`) sunar hem de `/api/*` isteklerine cevap verir:
giriş, ilerleme kaydı, datasheet depolama ve “Tepecan’a Sor”. Hepsi Cloudflare’in ücretsiz katmanında çalışır; yalnızca alan adı ücretlidir.

| Parça | Cloudflare ürünü | Kurulum |
|---|---|---|
| Site + API | **Workers** (statik dosyalarla) | GitHub bağlantısı, her `main` gönderiminde otomatik yayın |
| Veritabanı | **D1** | **Otomatik**: ilk yayında `eesim` veritabanı oluşturulur, tablolar ilk istekte kurulur |
| Yapay zekâ | **Workers AI** | **Otomatik** |
| Datasheet PDF’leri | **R2** | İsteğe bağlı: R2’yi etkinleştirip `wrangler.toml`’da üç satırı aç |
| Google ile giriş | Google Cloud OAuth | İsteğe bağlı: istemci kimliği + gizli anahtar |

> Ücretsiz kotalar değişebilir; güncel değerler için Cloudflare’in fiyat sayfalarına bak.
> Kabaca: Workers günde 100 bin istek, D1 5 GB, Workers AI günde 10 000 “neuron” ücretsizdir. Soru kotaları `wrangler.toml`’da.

---

## 1. İlk yayın (telefondan yapılabilir)

1. **GitHub bağlantısı:** Cloudflare panelinde **Workers & Pages → Create → Import a repository** ile `EESIM` deposunu bağla.
   Bu zaten yapıldıysa (Worker adı `eeesim`) bu adımı atla. Worker’ın adı `wrangler.toml`’daki `name` ile **aynı** olmalı.
2. **Build ayarları** (Worker → Settings → Build): build komutu boş kalabilir (`wrangler deploy` siteyi kendisi derler), deploy komutu `npx wrangler deploy`.
3. **İlk yayını başlat:** `main` dalına bir değişiklik merge et (ya da panelden **Retry build**). Bu yayın Worker’ı, D1 veritabanını ve tabloları kendiliğinden oluşturur.
4. **Kontrol:** `https://eeesim.<hesap-adın>.workers.dev/api/health` şunu göstermeli: `{"ok":true,"google":false,"ai":true,"db":true,"files":false}`
5. **Dene:** siteyi aç, e-posta ile kayıt ol, bir deney adımı tamamla, Tepecan’a bir soru sor.

## 2. Alan adı

1. **Domain Registration → Register Domains** → alan adını ara ve satın al (Cloudflare Registrar maliyet fiyatına satar).
   Başka bir yerden aldıysan: **Add a site** → Free plan → verilen iki nameserver’ı alan adını aldığın yerde gir.
2. **Workers & Pages → eeesim → Settings → Domains & Routes → Add → Custom domain** → `ALAN-ADIN` (ya da `sim.ALAN-ADIN`).
   DNS kaydı ve HTTPS sertifikası otomatik oluşur (birkaç dakika sürebilir).

## 3. Google ile giriş (isteğe bağlı)

1. <https://console.cloud.google.com> → yeni proje (ör. “EESIM”).
2. **APIs & Services → OAuth consent screen** (yeni arayüzde “Google Auth Platform”):
   - Uygulama adı: EESIM · destek e-postası: senin adresin · kullanıcı türü: **External**
   - Kapsamlar: `openid`, `email`, `profile` (hassas değildir, Google incelemesi gerekmez)
   - Test aşamasında en fazla 100 test kullanıcısı girebilir; herkese açmak için **Publish app** de.
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - **Authorized JavaScript origins:** `https://ALAN-ADIN` (ve `https://eeesim.<hesap-adın>.workers.dev`)
   - **Authorized redirect URIs:** `https://ALAN-ADIN/api/auth/google/callback` (ve workers.dev adresiyle aynısı)
4. **Client ID**’yi GitHub’da `wrangler.toml` → `GOOGLE_CLIENT_ID` satırına yaz.
5. **Client secret**’ı dosyaya yazma: panelde **eeesim → Settings → Variables and Secrets → Add → Type: Secret**, adı `GOOGLE_CLIENT_SECRET`.

## 4. Datasheet deposu — R2 (isteğe bağlı)

1. Panelde **R2 Object Storage** → R2’yi etkinleştir (ücretsiz katman için de ödeme yöntemi isteyebilir).
2. `wrangler.toml`’da `[[r2_buckets]]` ile başlayan üç satırın başındaki `#` işaretlerini kaldır ve merge et.
   `eesim-files` kovası ilk yayında otomatik oluşturulur.

R2 bağlı değilken kullanıcıların yüklediği PDF’ler yalnızca kendi tarayıcılarında saklanır; uygulamanın geri kalanı etkilenmez.

---

## Bilgisayardan çalışma (isteğe bağlı)

```bash
npm install
npx wrangler login          # tarayıcıda Cloudflare hesabınla onay ver
npm run dev                 # yalnızca arayüz: http://localhost:5173 (misafir modu)
npm run dev:api             # Worker yerelde: http://localhost:8787 (giriş, ilerleme, Tepecan’a Sor)
npm run deploy              # elle yayınla (GitHub bağlantısı varsa gerek yok)
```

`npm run dev:api`, Workers AI için Cloudflare’e bağlanır (AI her zaman Cloudflare’de çalışır). Giriş yapmadan denemek istersen
`wrangler.toml`’dan `[ai]` bölümünü geçici olarak kaldırıp `[vars]`’a `AI_FAKE = "1"` ekle: Tepecan sahte bir cevap akıtır, kota yine sayılır.
**Bu ayarı canlıya gönderme.**

## Yönetim komutları

```bash
# Bir kullanıcıyı premium yap (daha büyük model + günde 200 soru)
npx wrangler d1 execute eesim --remote --command "UPDATE users SET premium = 1 WHERE email = 'ornek@example.com'"

# Kullanıcı sayısı
npx wrangler d1 execute eesim --remote --command "SELECT COUNT(*) FROM users"

# Bugün en çok soru soranlar
npx wrangler d1 execute eesim --remote --command "SELECT user_id, count FROM ai_usage WHERE day = date('now') ORDER BY count DESC LIMIT 10"

# Süresi dolmuş oturumları temizle
npx wrangler d1 execute eesim --remote --command "DELETE FROM sessions WHERE expires_at < unixepoch() * 1000"
```

Aynı sorguları panelden de çalıştırabilirsin: **Storage & Databases → D1 → eesim → Console**.

## Güvenlik notları

- Şifreler PBKDF2-SHA256 (100 000 yineleme, rastgele tuz) ile saklanır; düz metin hiçbir yerde tutulmaz.
- Oturum çerezi `HttpOnly; Secure; SameSite=Lax`; veritabanında belirtecin yalnızca SHA-256 özeti durur.
- Durum değiştiren tüm `/api` istekleri yalnızca sitenin kendi kökeninden kabul edilir.
- Ücretsiz Workers planında istek başına CPU süresi sınırlıdır; şifre özeti bu sınıra yakın çalışır. Girişte
  “Worker exceeded CPU time limit” hatası görürsen Workers Paid planına geç (aylık ~5 $) ya da `functions/_lib.ts`’teki `PBKDF2_ITER` değerini düşür
  (mevcut hesaplar etkilenmez, yineleme sayısı özetin içinde saklanır).
