'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Copy, FileCode2 } from 'lucide-react';

const SCRIPT = `welcome_message:
    type: world
    events:
        on player joins:
        - narrate "Welcome, <player.name>!"
        - give diamond quantity:1`;

export function ScriptExample() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <div className="script-example">
      <div className="script-toolbar">
        <span><FileCode2 size={15} aria-hidden="true" /> welcome.dsc</span>
        <button type="button" onClick={copyScript} aria-label="Copy example script" className="copy-script">
          {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
          <span aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Try again' : 'Copy'}</span>
        </button>
      </div>
      <pre className="example-code" aria-label="Example Denizen welcome script"><code>
        <span className="code-line"><span className="example-key">welcome_message</span>:</span>{'\n'}
        <span className="code-line">{'    '}<span className="example-key">type</span>: world</span>{'\n'}
        <span className="code-line">{'    '}<span className="example-key">events</span>:</span>{'\n'}
        <span className="code-line">{'        '}<span className="example-event">on player joins</span>:</span>{'\n'}
        <span className="code-line">{'        '}- <span className="example-command">narrate</span> <span className="example-string">&quot;Welcome, <span className="example-tag">&lt;player.name&gt;</span>!&quot;</span></span>{'\n'}
        <span className="code-line">{'        '}- <span className="example-command">give</span> diamond <span className="example-key">quantity</span>:1</span>
      </code></pre>
      <div className="script-footer"><span><span className="script-status-dot" /> Denizen Script</span><Link href="/Docs/Languages/World%20Script%20Containers">Explore the syntax <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
    </div>
  );
}
