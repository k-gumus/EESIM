# EESIM güvenlik kontrol listesi

“Vibe coder’ların hacklendiği 20 yol” listesine göre EESIM’in durumu (6 Kasım 2026).
Her madde kodla kontrol edildi; düzeltilenler `worker/security.test.ts`, `worker/account.test.ts` ve `worker/ask.test.ts` ile test ediliyor.

| # | Saldırı | EESIM’de durum |
|---|---|---|
| 1 | Next.js başlığı (`x-middleware-subrequest` ile ara katmanı atlatma) | **Uygulanamaz.** Next.js yok; yetki denetimi her API işleyicisinde ayrı yapılıyor. |
| 2 | Yayında açık kalan `.git` klasörü | **Güvenli.** Yalnızca derlenmiş `dist/` yayınlanıyor; `/.git/…` istekleri uygulama sayfasına düşüyor. |
| 3 | Herkese açık Supabase deposu | **Uygulanamaz / güvenli.** PDF’ler R2’de özel; her istek oturum ve sahiplik (`user_id`) denetiminden geçiyor. |
| 4 | Fiyatı tarayıcıdan almak | **Güvenli.** Ödeme yok; premium, soru kotası ve yapay zekâ modeli yalnızca sunucuda belirleniyor. |
| 5 | Kimlik bilgisi doldurma (credential stuffing) | **Güçlendirildi.** IP başına 10 dk’da 10 deneme + **hesap başına saatte 20 deneme** (farklı IP’lerden gelse de). |
| 6 | Açık veritabanı | **Güvenli.** D1’e internetten doğrudan erişilemez; yalnızca Worker üzerinden, parametreli sorgularla. |
| 7 | Polyfill.io türü üçüncü taraf betik | **Güçlendirildi.** Dış betik yok (Cloudflare Analytics hariç). İçerik Güvenlik Politikası (CSP) artık **uygulanıyor**: başka bir kaynaktan betik yüklenemez. |
| 8 | SMS pompalama | **Uygulanamaz.** SMS yok. |
| 9 | İstem enjeksiyonu (prompt injection) | **Güçlendirildi.** Sunucu, istemcinin değiştiremeyeceği kuralları her isteğin başına ekliyor; konuşmanın ortasına `system` mesajı sokulamıyor; geçmiş 20 mesajla sınırlı. Yapay zekânın önerdiği devre düzeltmeleri beyaz listeden geçiyor ve kullanıcı onayı olmadan uygulanmıyor. Yanıtlar HTML olarak değil düz metin olarak çiziliyor (bağlantı yok). |
| 10 | Zayıf JWT anahtarı | **Uygulanamaz.** JWT yok; oturum 256 bit rastgele belirteç, veritabanında yalnızca SHA-256 özeti. |
| 11 | Yarış durumu | **Güçlendirildi.** Kota sayacı tek atomik sorgu; eşzamanlı aynı e-postayla kayıt artık 500 yerine 409 dönüyor. |
| 12 | Hesap ön-ele geçirme (pre-hijacking) | **Düzeltildi.** Biri senin e-postanla önceden şifreli hesap açsa bile, Google ile giriş yaptığın anda o şifre geçersiz olur ve hesaptaki diğer tüm oturumlar kapanır. |
| 13 | Alt alan adı ele geçirme | **Panelden kontrol.** `www.eeesim.fyi` için kayıt yok. Cloudflare DNS’te silinmiş bir servise (Vercel, GitHub Pages, Heroku…) işaret eden CNAME kaydı bırakma. |
| 14 | SSRF | **Güvenli.** Sunucu yalnızca sabit Google adreslerine istek atıyor; kullanıcının verdiği bir URL’ye istek atılmıyor. |
| 15 | Dizin gezintisi (path traversal) | **Güvenli.** Dosya anahtarları sunucunun ürettiği UUID’lerden oluşuyor ve önce veritabanında sahiplik doğrulanıyor. |
| 16 | Şifre sıfırlama zehirleme (Host başlığı) | **Uygulanamaz.** Şifre sıfırlama yok. Google yönlendirme adresi Google’da kayıtlı listeyle doğrulanıyor. |
| 17 | Kaynak haritaları (source maps) | **Güvenli.** Derlemede `.map` dosyası üretilmiyor. |
| 18 | Tıklama korsanlığı (clickjacking) | **Güvenli.** `X-Frame-Options: DENY` ve CSP `frame-ancestors 'none'`. |
| 19 | Açık yönlendirme | **Güvenli.** Yönlendirmeler sabit adreslere (`/?login=ok`, Google); kullanıcıdan gelen adrese yönlendirme yok. |
| 20 | Kullanıcı sayımı (user enumeration) | **Güçlendirildi.** Girişte e-posta yoksa, şifre yanlışsa ya da hesap Google hesabıysa **aynı mesaj ve aynı süre** (sahte PBKDF2). Kayıtta “bu e-posta kayıtlı” mesajı e-posta doğrulaması olmadan kaçınılmaz; IP başına saatte 5 kayıt sınırıyla yavaşlatılıyor. |

## Ek olarak

- API yanıtlarında iç hata ayrıntısı (SQL, yığın izi) artık istemciye gönderilmiyor; yalnızca Worker günlüğüne yazılıyor.
- Durum değiştiren tüm `/api` istekleri başka kökenden geliyorsa reddediliyor (CSRF).
- Oturum çerezi `HttpOnly; Secure; SameSite=Lax`.
- KVKK: kullanıcı hesabını ve tüm verilerini kendisi silebiliyor (`DELETE /api/auth/me`).

## Panelden yapılması önerilenler

1. **Cloudflare → eeesim.fyi → Security → WAF → Rate limiting rules:** `/api/auth/` için “IP başına 10 dakikada 20 istek, aşılırsa 10 dakika engelle”. Koddaki sınırın önünde, istekler Worker’a ulaşmadan durur.
2. **DNS:** Kullanmadığın her kaydı sil (özellikle CNAME’ler).
3. **Cloudflare → Security → Bots → Bot Fight Mode:** aç (ücretsiz).
