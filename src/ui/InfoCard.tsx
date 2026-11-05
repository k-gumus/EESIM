// Eleman bilgi kartı: ne işe yarar / nasıl çalışır / tipik değerler / dikkat / özellikler / datasheet
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '../store/uiStore';
import { useAuth } from '../auth/store';
import { openLogin } from '../auth/api';
import { LIBRARY as LIB } from '../circuit/library';
import { infoOf } from '../circuit/info';
import { Symbol } from './symbols';
import { TEMPLATES } from '../templates';
import { CATALOG } from '../templates/catalog';
import { openEntry } from './TopBar';
import { POSES } from '../tepecan/mascot';
import { addDatasheet, fmtSize, listDatasheets, openDatasheet, removeDatasheet, type Datasheet } from '../datasheets/store';
import type { CompType } from '../circuit/types';

function BigSymbol({ type }: { type: CompType }) {
  const def = LIB[type];
  const pad = 10;
  return (
    <svg viewBox={`${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}`} className="info-sym" style={{ color: 'var(--sym)' }}>
      <Symbol type={type} params={Object.fromEntries(def.params.map((p) => [p.key, p.default]))} />
    </svg>
  );
}

export function InfoCard() {
  const type = useUI((s) => s.infoType);
  const close = () => useUI.getState().showInfo(null);
  useEffect(() => {
    if (!type) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [type]);
  if (!type) return null;
  return <InfoBody key={type} type={type} onClose={close} />;
}

function InfoBody({ type, onClose }: { type: CompType; onClose: () => void }) {
  const def = LIB[type];
  const info = infoOf(type);
  const user = useAuth((s) => s.user);
  const [sheets, setSheets] = useState<Datasheet[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const used = useMemo(
    () => TEMPLATES.filter((t) => t.doc.components.some((c) => c.type === type)).map((t) => CATALOG.find((e) => e.id === t.id)!),
    [type],
  );

  const refresh = () => listDatasheets(type).then(setSheets);
  useEffect(() => {
    refresh();
  }, [type, user?.id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    setBusy(true);
    try {
      for (const f of Array.from(files)) await addDatasheet(type, f);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal info-modal" onClick={(e) => e.stopPropagation()} data-testid="infocard">
        <div className="info-head">
          <div className="info-symbox">
            <BigSymbol type={type} />
          </div>
          <div className="info-title">
            <div className="info-cat">{def.category}</div>
            <h2>{def.label}</h2>
            <p>{def.description}</p>
          </div>
          <button className="iconbtn close" onClick={onClose} title="Kapat (Esc)">
            ✕
          </button>
        </div>

        <div className="info-body">
          {info ? (
            <>
              <section className="info-sec">
                <h4>Ne işe yarar?</h4>
                <p>{info.what}</p>
              </section>
              <section className="info-sec">
                <h4>Nasıl çalışır?</h4>
                <p>{info.how}</p>
                {info.formula && <div className="info-formula">{info.formula}</div>}
              </section>
              <section className="info-sec">
                <h4>Tipik değerler ve kullanım</h4>
                <ul>
                  {info.typical.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
              {info.caution && (
                <section className="info-sec info-caution">
                  <img src={POSES.angry} alt="" />
                  <div>
                    <h4>Dikkat!</h4>
                    <ul>
                      {info.caution.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
              {info.specs && (
                <section className="info-sec">
                  <h4>Kılıf ve sınır değerler</h4>
                  <table className="info-specs">
                    <tbody>
                      {info.specs.map(([k, v]) => (
                        <tr key={k}>
                          <th>{k}</th>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          ) : (
            <p className="muted">Bu eleman için ayrıntılı bilgi kartı henüz hazır değil.</p>
          )}

          {used.length > 0 && (
            <section className="info-sec">
              <h4>Bu elemanla yapılan deneyler</h4>
              <div className="info-exps">
                {used.map((e) => (
                  <button
                    key={e.id}
                    className="chip"
                    onClick={() => {
                      openEntry(e);
                      onClose();
                    }}
                  >
                    ▶ {e.title}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="info-sec">
            <h4>Datasheet</h4>
            {info?.datasheets && (
              <ul className="info-links">
                {info.datasheets.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      📄 {d.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div
              className={`info-drop ${drag ? 'drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                upload(e.dataTransfer.files);
              }}
            >
              <div>
                <b>Kendi datasheet’ini ekle</b> — PDF’i buraya sürükle ya da{' '}
                <button className="linkbtn" onClick={() => fileRef.current?.click()} disabled={busy}>
                  dosya seç
                </button>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
              </div>
              <div className="muted small">
                {user ? (
                  <>Hesabına kaydedilir; her cihazdan erişebilirsin.</>
                ) : (
                  <>
                    Misafir modunda yalnızca bu tarayıcıda saklanır.{' '}
                    <button className="linkbtn" onClick={openLogin}>
                      Giriş yap
                    </button>{' '}
                    ve her cihazdan eriş.
                  </>
                )}
              </div>
              {busy && <div className="small">Yükleniyor…</div>}
              {err && <div className="small err">{err}</div>}
            </div>
            {sheets && sheets.length > 0 && (
              <ul className="info-files">
                {sheets.map((s) => (
                  <li key={s.id}>
                    <button className="linkbtn" onClick={() => openDatasheet(s)}>
                      📎 {s.name}
                    </button>
                    <span className="muted small">
                      {fmtSize(s.size)} · {s.where === 'cloud' ? '☁ hesapta' : '💾 bu cihazda'}
                    </span>
                    <button className="iconbtn" title="Sil" onClick={() => removeDatasheet(s).then(refresh)}>
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
