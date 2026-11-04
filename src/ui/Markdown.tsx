// Çok küçük, güvenli markdown alt kümesi: **kalın**, `kod`, madde işaretleri, ```kod blokları```
import { Fragment } from 'react';

function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<b key={`${key}-${i++}`}>{tok.slice(2, -2)}</b>);
    else out.push(<code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="md">
      {blocks.map((b, bi) =>
        bi % 2 === 1 ? (
          <pre key={bi}>{b.replace(/^[a-z-]*\n/, '')}</pre>
        ) : (
          <Fragment key={bi}>
            {b
              .split('\n')
              .filter((l, i, arr) => !(l.trim() === '' && (i === 0 || i === arr.length - 1)))
              .map((line, li) => {
                const t = line.trim();
                if (!t) return <div key={li} className="md-gap" />;
                const bullet = /^([-•*]|\d+[.)])\s+/.exec(t);
                if (bullet)
                  return (
                    <div key={li} className="md-li">
                      <span className="md-dot">{/\d/.test(bullet[1]) ? bullet[1] : '•'}</span>
                      <span>{inline(t.slice(bullet[0].length), `${bi}-${li}`)}</span>
                    </div>
                  );
                if (/^#{1,4}\s/.test(t)) return <div key={li} className="md-h">{inline(t.replace(/^#+\s/, ''), `${bi}-${li}`)}</div>;
                return <div key={li}>{inline(line, `${bi}-${li}`)}</div>;
              })}
          </Fragment>
        ),
      )}
    </div>
  );
}
