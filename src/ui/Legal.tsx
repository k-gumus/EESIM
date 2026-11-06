// Gizlilik / KVKK aydınlatma metni ve kullanım koşulları (TR + EN).
// Doğrudan bağlantı: https://<site>/#gizlilik  ·  /#kosullar   (Google OAuth onay ekranı da bu adresleri ister)
// NOT: Bu metinler iyi niyetli bir şablondur; hukuki danışmanlık yerine geçmez.
import { useEffect } from 'react';
import { create } from 'zustand';
import { useLang, t } from '../i18n';

export const CONTACT_EMAIL = 'iletisim@eeesim.fyi';
const CONTROLLER = 'Kerem Gümüş';
const UPDATED = '6 Kasım 2026';
const UPDATED_EN = '6 November 2026';

type Page = 'privacy' | 'terms';
const useLegal = create<{ page: Page | null }>(() => ({ page: null }));
const HASH: Record<Page, string> = { privacy: '#gizlilik', terms: '#kosullar' };

export function openLegal(page: Page) {
  useLegal.setState({ page });
}

type Block = [h: string, body: string[]];

const PRIVACY_TR: Block[] = [
  ['Veri sorumlusu', [`EESIM, ${CONTROLLER} tarafından geliştirilen ücretsiz bir eğitim aracıdır. 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${CONTROLLER}’tür. İletişim: ${CONTACT_EMAIL}`]],
  [
    'Hangi verileri işliyoruz?',
    [
      '**Hesap açarsan:** ad soyad, e-posta adresi ve şifrenin geri döndürülemez özeti (PBKDF2). Şifrenin kendisi hiçbir yerde saklanmaz. Google ile girersen Google’ın paylaştığı ad, e-posta, profil fotoğrafı bağlantısı ve hesap kimliği.',
      '**Öğrenme ilerlemen:** XP, seviye, günlük seri, tamamlanan deney adımları (hesabınla eşitlemek için).',
      '**Yüklediğin datasheet PDF’leri:** bulut deposu açıksa sunucuda, değilse yalnızca tarayıcında saklanır.',
      '**Tepecan’a sorduğun sorular:** sorunla birlikte devrenin özeti yapay zekâ modeline (Cloudflare Workers AI) gönderilir ve cevap üretildikten sonra EESIM tarafından saklanmaz. Yalnızca günlük soru sayın tutulur.',
      '**Teknik veriler:** kötüye kullanımı önlemek için IP adresinin tek yönlü özeti (soru kotası ve giriş deneme sınırı için), oturum bilgisi ve barındırma sağlayıcısının tuttuğu standart erişim kayıtları.',
      '**Ziyaret istatistikleri:** Cloudflare Web Analytics ile çerezsiz, kişiyi tanımlamayan sayfa görüntüleme sayıları.',
    ],
  ],
  [
    'Neden işliyoruz? (amaç ve hukuki sebep)',
    [
      'Hesabını oluşturmak, giriş yapmanı sağlamak ve ilerlemeni cihazlar arasında eşitlemek (sözleşmenin ifası, KVKK m. 5/2-c).',
      'Hizmetin güvenliğini sağlamak, kaba kuvvet ve kötüye kullanımı önlemek (meşru menfaat, KVKK m. 5/2-f).',
      'Yapay zekâ asistanının sorunu yanıtlaması (talebin yerine getirilmesi, KVKK m. 5/2-c).',
      'Verilerin reklam, profilleme ya da satış amacıyla kullanılması **söz konusu değildir**.',
    ],
  ],
  [
    'Çerezler ve tarayıcı depolama',
    [
      '**sid**: giriş yaptığında oturumunu açık tutan zorunlu çerez (30 gün). Google ile girişte birkaç dakikalık güvenlik çerezi kullanılır.',
      'Devrelerin, ayarların, dil tercihin, misafir ilerlemen ve yerel PDF’ler tarayıcının yerel depolamasında (localStorage/IndexedDB) tutulur; sunucuya gönderilmez.',
      'Reklam ya da izleme çerezi kullanılmaz.',
    ],
  ],
  [
    'Kimlerle paylaşılıyor, nerede saklanıyor?',
    [
      'EESIM, **Cloudflare, Inc.** altyapısında (Workers, D1 veritabanı, R2 depolama, Workers AI) çalışır. Veriler bu nedenle Türkiye dışındaki veri merkezlerinde işlenebilir. Hesap oluşturarak ve hizmeti kullanarak bu aktarıma açık rıza vermiş olursun (KVKK m. 9).',
      'Google ile giriş seçersen kimlik doğrulama Google üzerinden yapılır.',
      'Tarayıcı içi yapay zekâyı (WebLLM) seçersen model dosyaları Hugging Face’ten indirilir; Ollama seçersen sorular yalnızca kendi bilgisayarına gider.',
      'Veriler üçüncü kişilere satılmaz ve kanunen zorunlu durumlar dışında paylaşılmaz.',
    ],
  ],
  [
    'Ne kadar süre saklanıyor?',
    [
      'Hesap ve ilerleme verileri, hesabını silene kadar.',
      'Oturum kayıtları en fazla 30 gün; günlük soru sayaçları ve giriş deneme sayaçları en fazla 7 gün.',
      'Hesabını sildiğinde hesabın, ilerlemen, oturumların ve yüklediğin PDF’ler kalıcı olarak silinir.',
    ],
  ],
  [
    'Hakların (KVKK m. 11)',
    [
      'Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme, işlemeye itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların vardır.',
      '**Hesabını istediğin an kendin silebilirsin:** sağ üstteki profil menüsü → “Hesabımı sil”.',
      `Diğer talepler için ${CONTACT_EMAIL} adresine yazabilirsin; en geç 30 gün içinde yanıtlanır.`,
    ],
  ],
  ['Değişiklikler', [`Bu metin güncellenebilir; önemli değişiklikler sitede duyurulur. Son güncelleme: ${UPDATED}.`]],
];

const PRIVACY_EN: Block[] = [
  ['Data controller', [`EESIM is a free educational tool developed by ${CONTROLLER}, who is the data controller under Turkish Personal Data Protection Law No. 6698 (KVKK). Contact: ${CONTACT_EMAIL}`]],
  [
    'What we process',
    [
      '**If you create an account:** your name, e-mail address and an irreversible hash of your password (PBKDF2). Your password itself is never stored. If you sign in with Google: the name, e-mail, profile picture link and account ID that Google shares.',
      '**Your learning progress:** XP, level, daily streak and completed experiment steps (to sync them with your account).',
      '**Datasheet PDFs you upload:** stored on the server if cloud storage is enabled, otherwise only in your browser.',
      '**Questions you ask Tepecan:** your question and a summary of your circuit are sent to an AI model (Cloudflare Workers AI) and are not stored by EESIM after the answer is generated. Only your daily question count is kept.',
      '**Technical data:** a one-way hash of your IP address (for the question quota and login attempt limits), session data and the standard access logs kept by the hosting provider.',
      '**Visit statistics:** cookieless, non-identifying page view counts via Cloudflare Web Analytics.',
    ],
  ],
  [
    'Why we process it (purpose and legal basis)',
    [
      'To create your account, let you sign in and sync your progress across devices (performance of a contract, KVKK Art. 5/2-c).',
      'To keep the service secure and prevent brute-force attempts and abuse (legitimate interest, KVKK Art. 5/2-f).',
      'To let the AI assistant answer your question (fulfilling your request, KVKK Art. 5/2-c).',
      'Your data is **never** used for advertising, profiling or sold.',
    ],
  ],
  [
    'Cookies and browser storage',
    [
      '**sid**: a strictly necessary cookie that keeps you signed in (30 days). Google sign-in uses a short-lived security cookie for a few minutes.',
      'Your circuits, settings, language choice, guest progress and local PDFs are kept in your browser’s local storage (localStorage/IndexedDB) and are not sent to the server.',
      'No advertising or tracking cookies are used.',
    ],
  ],
  [
    'Who it is shared with and where it is stored',
    [
      'EESIM runs on **Cloudflare, Inc.** infrastructure (Workers, D1 database, R2 storage, Workers AI), so data may be processed in data centres outside Turkey. By creating an account and using the service you consent to this transfer (KVKK Art. 9).',
      'If you choose Google sign-in, authentication is handled by Google.',
      'If you choose in-browser AI (WebLLM), model files are downloaded from Hugging Face; with Ollama your questions only go to your own computer.',
      'Data is never sold and is not shared with third parties except where required by law.',
    ],
  ],
  [
    'How long it is kept',
    [
      'Account and progress data: until you delete your account.',
      'Session records: at most 30 days; daily question and login attempt counters: at most 7 days.',
      'When you delete your account, your account, progress, sessions and uploaded PDFs are permanently deleted.',
    ],
  ],
  [
    'Your rights (KVKK Art. 11)',
    [
      'You have the right to learn whether your data is processed, request information, ask for correction or deletion, object to processing and claim compensation for damages.',
      '**You can delete your account yourself at any time:** profile menu (top right) → “Delete my account”.',
      `For other requests write to ${CONTACT_EMAIL}; we reply within 30 days at the latest.`,
    ],
  ],
  ['Changes', [`This notice may be updated; important changes are announced on the site. Last updated: ${UPDATED_EN}.`]],
];

const TERMS_TR: Block[] = [
  ['Hizmet', ['EESIM, elektrik-elektronik öğrencileri için ücretsiz bir devre simülasyonu ve öğrenme aracıdır. Hizmet “olduğu gibi” sunulur; kesintisiz ya da hatasız çalışacağı garanti edilmez.']],
  [
    'Simülasyon ve yapay zekâ sonuçları',
    [
      'Simülasyon sonuçları basitleştirilmiş eleman modellerine dayanan **yaklaşık** değerlerdir. Gerçek bir devreyi, özellikle şebeke gerilimi, yüksek akım ya da güvenlik açısından kritik sistemleri yalnızca bu sonuçlara dayanarak tasarlamayın.',
      'Tepecan’ın (yapay zekâ) cevapları hatalı olabilir. Önemli konularda ders kitabı ve hocanla doğrula.',
    ],
  ],
  [
    'Hesabın',
    [
      'Hesap bilgilerinin doğruluğundan ve şifrenin gizliliğinden sen sorumlusun.',
      'Hizmeti kötüye kullanmak (otomatik istek seli, başkasının hesabına erişmeye çalışmak, yapay zekâyı zararlı içerik üretmek için kullanmak, sisteme zarar vermek) yasaktır; bu durumda hesap kapatılabilir.',
      'Hesabını istediğin an silebilirsin.',
    ],
  ],
  ['İçerik', ['Kurduğun devreler ve yüklediğin dosyalar sana aittir. Telif hakkı sana ait olmayan ya da hukuka aykırı içerik yükleme. Uygulamadaki deney föyleri, görseller ve yazılım EESIM’e aittir; yazılımın kaynak kodu depoda belirtilen lisansla (MIT) kullanılabilir.']],
  ['Sorumluluğun sınırı', ['Yasaların izin verdiği ölçüde, hizmetin kullanımından ya da kullanılamamasından doğan dolaylı zararlardan EESIM sorumlu tutulamaz.']],
  ['Değişiklikler ve iletişim', [`Bu koşullar güncellenebilir; güncel hâli her zaman bu sayfadadır. Sorular için: ${CONTACT_EMAIL}. Son güncelleme: ${UPDATED}.`]],
];

const TERMS_EN: Block[] = [
  ['The service', ['EESIM is a free circuit simulation and learning tool for electrical and electronics students. It is provided “as is”, without any guarantee that it will be uninterrupted or error-free.']],
  [
    'Simulation and AI results',
    [
      'Simulation results are **approximate** values based on simplified component models. Do not design a real circuit — especially mains-voltage, high-current or safety-critical systems — based on these results alone.',
      'Tepecan’s (AI) answers can be wrong. Double-check important points with your textbook and instructor.',
    ],
  ],
  [
    'Your account',
    [
      'You are responsible for the accuracy of your account details and for keeping your password secret.',
      'Abusing the service (automated request floods, trying to access other accounts, using the AI to produce harmful content, damaging the system) is prohibited and may lead to account closure.',
      'You can delete your account at any time.',
    ],
  ],
  ['Content', ['The circuits you build and the files you upload are yours. Do not upload content you do not have rights to or that is unlawful. The experiment sheets, images and software in the app belong to EESIM; the source code may be used under the licence stated in the repository (MIT).']],
  ['Limitation of liability', ['To the extent permitted by law, EESIM is not liable for indirect damages arising from the use of, or inability to use, the service.']],
  ['Changes and contact', [`These terms may be updated; the current version is always on this page. Questions: ${CONTACT_EMAIL}. Last updated: ${UPDATED_EN}.`]],
];

const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));

export function LegalModal() {
  const page = useLegal((s) => s.page);
  const lang = useLang((s) => s.lang);

  // #gizlilik / #kosullar ile doğrudan açılış
  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.toLowerCase();
      if (h === '#gizlilik' || h === '#privacy' || h === '#kvkk') openLegal('privacy');
      else if (h === '#kosullar' || h === '#terms') openLegal('terms');
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  if (!page) return null;
  const blocks = page === 'privacy' ? (lang === 'en' ? PRIVACY_EN : PRIVACY_TR) : lang === 'en' ? TERMS_EN : TERMS_TR;
  const close = () => {
    useLegal.setState({ page: null });
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };
  return (
    <div className="modal-back legal-back" onClick={close}>
      <div className="modal legal-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid="legal">
        <div className="legal-head">
          <nav className="legal-tabs">
            {(['privacy', 'terms'] as Page[]).map((p) => (
              <button key={p} className={page === p ? 'on' : ''} onClick={() => (useLegal.setState({ page: p }), history.replaceState(null, '', HASH[p]))}>
                {p === 'privacy' ? t('Gizlilik ve KVKK') : t('Kullanım Koşulları')}
              </button>
            ))}
          </nav>
          <button className="iconbtn" onClick={close} title={t('Kapat')}>
            ✕
          </button>
        </div>
        <div className="legal-body">
          <h2>{page === 'privacy' ? t('Gizlilik ve KVKK Aydınlatma Metni') : t('Kullanım Koşulları')}</h2>
          {blocks.map(([h, body]) => (
            <section key={h}>
              <h3>{h}</h3>
              {body.length === 1 ? (
                <p>{bold(body[0])}</p>
              ) : (
                <ul>
                  {body.map((b, i) => (
                    <li key={i}>{bold(b)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
