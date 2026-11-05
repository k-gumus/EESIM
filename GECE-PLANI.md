# IEEESIM — Gece Çalışma Planı (5 Kasım 2026, 03:30 →)

Kaynak: Kerem'in el yazısı notları (sim.pdf). Her aşama bitince bu dosyadaki kutu işaretlenir ve
`İLERLEME` bölümüne bir satır eklenir. Kullanım limiti dolarsa bir sonraki planlı mesajda buradan devam edilir.

## Kararlar (Kerem'e sorulmadan alındı, sabah gözden geçirilecek)
- Üst bar: “Dosya” bir açılır menü (Yeni, Aç Ctrl+O, Kaydet Ctrl+S, Netlist görüntüle, .cir indir, katalog). “Deney bul” Türkçe karakterden bağımsız arama yapar, Ctrl+K ile odaklanır.
- “Değerler” düğmesinin adı “Değer Okuma” oldu; 3D/Osiloskop/Değer Okuma ve Başlat/Duraklat tek bir “Simülasyon araçları” grubunda.
- Sağ üstte kullanıcı menüsü (misafir/giriş, tanıtım turu, çıkış) eklendi.
- Barındırma: Cloudflare Pages (statik site) + Pages Functions/Workers (API).
- Giriş: Google ile giriş + e-posta/şifre; oturumlar ve kullanıcı verisi D1'de; datasheet ve kayıtlı devre dosyaları R2'de.
  “Misafir olarak devam et” seçeneği kalır (veriler tarayıcıda tutulur).
- Tepecan'a Sor: varsayılan sağlayıcı Cloudflare Workers AI (sunucu tarafı, kurulum gerektirmez); Ollama/WebLLM gelişmiş ayar olarak kalır.
  Kullanıcı başına günlük kota + `premium` bayrağı (ileride ücretli plan için hazır).
- Deney kataloğu ders koduna göre değil konu başlığına göre kategorize edilir.

## Görevler
- [x] 0. Ortam: proje klasörü + node_modules kontrolü, eksikse Kerem'in klasöründen geri yükle; git init; testler yeşil
- [x] 1. Üst bar yeniden tasarımı: Logo | Dosya (Yeni/Aç/Kaydet/Netlist-JSON dışa aktar) | Deney bul (arama, Ctrl+K) | açık deney adı | Simülasyon araçları (3D / Osiloskop / Değer okuma) + Başlat
- [x] 2. Sağ panel: “Tepecan AI” → “Tepecan'a Sor”
- [ ] 3. Motor genişletme: kontrollü kaynaklar (E/G/F/H), op-amp makro modeli (doyumlu), potansiyometre, buton (pull-up/pull-down örnekleri), pil, lamba, Schottky, LDR/termistör, lojik kapılar + saat kaynağı, 555 (davranışsal), BJT/MOSFET hazır modelleri (2N2222, BC547, 2N7000, IRF540)
- [ ] 4. Eleman bilgi kartları: Ne işe yarar / Nasıl çalışır / Tipik değerler / Dikkat (ör. pull-down neden gerekir) / malzeme-kılıf-sınır değerleri / datasheet bağlantısı + PDF yükleme (misafirde IndexedDB, girişli kullanıcıda R2)
- [ ] 5. Deney kataloğu: elektrik-elektronik mühendisliği eğitimi ve kariyerinde karşılaşılan deneylerin konu başlıklarına göre tam listesi; platformda simüle edilebilenler adım adım şablon olarak, kategori sayfası + arama
- [ ] 6. Giriş sistemi: giriş ekranı, Google OAuth + e-posta/şifre, D1 şeması, oturum çerezleri, ilerleme/XP senkronu, wrangler ile yerel test
- [ ] 7. İlk giriş eğitimi (Tepecan'lı adım adım tur) + sonraki girişler için “yenilikler / kaldığın yer” turu, “turu tekrar göster”
- [ ] 8. Tepecan'a Sor backend: /api/ask (Workers AI), kota, premium bayrağı
- [ ] 9. Test (birim + tarayıcı), build, Kerem'in klasörüne teslim, Cloudflare kurulum rehberi (alan adı, Pages, D1, R2, Google OAuth anahtarları)

## İLERLEME
- 2026-11-04 23:50 — Plan yazıldı, 03:30 başlangıcı planlandı.
- 2026-11-05 07:10 — Görev 0–2 tamam: ortam sağlam (23 test yeşil), yeni üst bar + Dosya menüsü + Deney bul + kullanıcı menüsü, “Tepecan'a Sor”.
