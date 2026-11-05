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
- Op-amp makro modeli: giriş direnci → slew sınırlı gm → baskın kutup (R1‖C1) → yumuşak doyumlu çıkış. Besleme pinleri yok; ±Vcc parametre. LM741/TL081/LM358/ideal hazır modelleri.
- Lojik: 5 V CMOS benzeri davranışsal kapılar; boşta giriş ~2,5 V'a süzülür (belirsiz) → pull-up/pull-down dersi gerçekçi. D-FF ve 555 durumları her kabul edilen adımda güncellenir.
- Bağımlı kaynaklar (E/G/F/H) teorik eleman: 3D montajda gösterilmez.
- Osiloskoba XY modu eklendi (karakteristik eğriler, Lissajous).
- Görev 5, 4'ten önce yapıldı: bilgi kartları katalogdaki deneylere bağlantı vereceği için önce katalog kuruldu.
- Katalog: 12 konu başlığı; 49 etkileşimli föy + 66 “yakında” deney (toplam 115). Etkileşimli olmayanlar silik kartla listelenir, aranabilir.
  “★ Başlangıç yolu”: LED/Ohm → bölücü → RC → yarım dalga → pull-down → kapılar → eviren op-amp → 555.
- Her föyün test sorularının doğru şıkkı birim testlerinde simülasyonla doğrulanır (catalog.test.ts).
- Motor: Newton yakınsamazsa adım 8'e, sonra 64'e bölünür; yine olmazsa sözde-geçici gevşetme ile sıçrama çözülür (multivibratör, mandal).
  DC çalışma noktası için de aynı gevşetme son çare olarak eklendi (SR mandal artık açılışta hata vermiyor, belirsiz durumda başlıyor).
- Bilgi kartı paletteki her elemanın üstündeki “i” düğmesinden ve Özellikler panelindeki “ⓘ Bilgi kartı” bağlantısından açılır.
  Datasheet bağlantıları: TI parçaları için doğrudan TI PDF’i, diğerleri için Octopart araması (kırık bağlantı riski olmasın diye).
  Kullanıcı PDF’i: misafirde IndexedDB, girişte /api/datasheets → R2 (sunucu tarafı Görev 6’da). “Bu elemanla yapılan deneyler” katalogdan otomatik çıkarılır.
- Giriş: açılışta /api/health ile sunucu aranır. Sunucu yoksa (tek dosya/GitHub Pages) giriş ekranı “çevrimdışı sürüm” notuyla yalnızca misafir seçeneği sunar.
  Misafir seçimi tarayıcıda hatırlanır; sağ üstteki menüden her zaman “Giriş yap” denebilir.
- Oturum: 30 günlük HttpOnly + SameSite=Lax çerez; veritabanında belirtecin yalnızca SHA-256 özeti tutulur. Şifre: PBKDF2-SHA256, 100 000 yineleme (Workers üst sınırı), 16 bayt tuz.
  Durum değiştiren /api istekleri yalnızca aynı kökenden kabul edilir (CSRF önlemi).
- Google ile giriş: OAuth 2.0 yetkilendirme kodu akışı + state çerezi; aynı e-postalı şifreli hesap varsa Google ona bağlanır (Google e-postayı doğruladığı için).
- İlerleme eşitleme: XP en büyüğü, adım/deney kümeleri birleşimi; değişiklikler 1,5 sn gecikmeyle sunucuya yazılır.
- Kayıtlı devrelerin buluta yazılması bu gece yapılmadı (şema dışı bırakıldı) — sonraki adım.
- Saat kaynağı (clock) olan devrelerde zaman adımı periyodun 1/100'ü ile sınırlanır (buck/boost doğru çalışsın diye).

## Görevler
- [x] 0. Ortam: proje klasörü + node_modules kontrolü, eksikse Kerem'in klasöründen geri yükle; git init; testler yeşil
- [x] 1. Üst bar yeniden tasarımı: Logo | Dosya (Yeni/Aç/Kaydet/Netlist-JSON dışa aktar) | Deney bul (arama, Ctrl+K) | açık deney adı | Simülasyon araçları (3D / Osiloskop / Değer okuma) + Başlat
- [x] 2. Sağ panel: “Tepecan AI” → “Tepecan'a Sor”
- [x] 3. Motor genişletme: kontrollü kaynaklar (E/G/F/H), op-amp makro modeli (doyumlu), potansiyometre, buton (pull-up/pull-down örnekleri), pil, lamba, Schottky, LDR/termistör, lojik kapılar + saat kaynağı, 555 (davranışsal), BJT/MOSFET hazır modelleri (2N2222, BC547, 2N7000, IRF540)
- [x] 4. Eleman bilgi kartları: Ne işe yarar / Nasıl çalışır / Tipik değerler / Dikkat (ör. pull-down neden gerekir) / malzeme-kılıf-sınır değerleri / datasheet bağlantısı + PDF yükleme (misafirde IndexedDB, girişli kullanıcıda R2)
- [x] 5. Deney kataloğu: elektrik-elektronik mühendisliği eğitimi ve kariyerinde karşılaşılan deneylerin konu başlıklarına göre tam listesi; platformda simüle edilebilenler adım adım şablon olarak, kategori sayfası + arama
- [x] 6. Giriş sistemi: giriş ekranı, Google OAuth + e-posta/şifre, D1 şeması, oturum çerezleri, ilerleme/XP senkronu, wrangler ile yerel test
- [ ] 7. İlk giriş eğitimi (Tepecan'lı adım adım tur) + sonraki girişler için “yenilikler / kaldığın yer” turu, “turu tekrar göster”
- [ ] 8. Tepecan'a Sor backend: /api/ask (Workers AI), kota, premium bayrağı
- [ ] 9. Test (birim + tarayıcı), build, Kerem'in klasörüne teslim, Cloudflare kurulum rehberi (alan adı, Pages, D1, R2, Google OAuth anahtarları)

## İLERLEME
- 2026-11-04 23:50 — Plan yazıldı, 03:30 başlangıcı planlandı.
- 2026-11-05 07:10 — Görev 0–2 tamam: ortam sağlam (23 test yeşil), yeni üst bar + Dosya menüsü + Deney bul + kullanıcı menüsü, “Tepecan'a Sor”.
- 2026-11-05 07:40 — Görev 3 tamam: op-amp, E/G/F/H, potansiyometre, buton, pil, lamba, LDR, NTC, 7805, 6 lojik kapı, D-FF, saat, lojik giriş/gösterge, 555, BJT/MOSFET/Schottky hazır modelleri; semboller, SPICE çıktısı, 3D (DIP/TO-220/trimpot), osiloskop XY. 40 test yeşil.
- 2026-11-05 07:50 — Görev 5 tamam: konu başlıklı katalog penceresi (kenar çubuğu, arama, seviye filtresi, yakında olanlar), 42 yeni föy (DC, geçici, AC, filtre, diyot, BJT, MOSFET, op-amp, osilatör, güç, dijital, ölçme), 66 planlı deney; motor sağlamlaştırma. 60 test yeşil.
- 2026-11-05 08:05 — Görev 4 tamam: 45 elemanın bilgi kartı (ne işe yarar, nasıl çalışır, formül, tipik değerler, dikkat, kılıf/sınır değerler, datasheet), PDF yükleme (IndexedDB; girişte buluta), elemanı kullanan deneylere kısayol. 61 test yeşil.
- 2026-11-05 08:25 — Görev 6 tamam: giriş ekranı (Google, e-posta/şifre, kayıt, misafir, çevrimdışı modu), Pages Functions API (auth, progress, datasheets → R2), D1 şeması, wrangler.toml; wrangler ile yerelde uçtan uca test edildi (kayıt, giriş, hatalı şifre, çıkış, ilerleme, PDF yükle/indir/sil, köken denetimi, Google yönlendirmesi). 63 test yeşil.
