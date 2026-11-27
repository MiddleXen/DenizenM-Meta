/**
 * Extracts DenizenM async-safety markings straight from the Java sources, so the site follows the code
 * automatically instead of a hand-copied table drifting out of date.
 *
 * Three sources are read, from every source zip (core, plugin and addons alike):
 *  - Command classes: `setName("x")` together with `asyncSafe = true` / `setAsyncSafe(true)` / `setAsyncWaitable(true)` /
 *    `setAsyncDeferrable(true)`, plus `isAsyncSafe(ScriptEntry)` / `isAsyncDeferrable(ScriptEntry)` overrides (conditional).
 *  - The machine-readable map comments (`// @asyncsave`, `// @asyncbase`, `// @asynccmd`) in CommonRegistries.java.
 *  - `TagManager.markMainThreadOnly("<base>", ...)` calls, for the safe sub-tags of main-thread-only tag bases (eg `<server.x>`).
 *  - `TagManager.markObjectTypeMainThreadOnly(XTag.class, ...)` / `markObjectTypeTagsMainThreadOnly(XTag.class, "a", ...)` calls:
 *    which object types (or single tags of an otherwise pure-data type) DenizenM hands to the main thread. Anything not
 *    marked anywhere runs directly on the async thread - which matters for addon types, since no addon marks anything.
 */

export interface AsyncCommandMarking {
  runsAsync: boolean;
  /** Async-safe only for some uses (an `isAsyncSafe(ScriptEntry)` override). */
  runsAsyncConditional?: boolean;
  deferrable: boolean;
  /** Qualifier from the `@asynccmd deferrable` map, eg `per_player` or `id`. */
  deferrableQualifier?: string;
}

export interface AsyncSafetyData {
  commands: Record<string, AsyncCommandMarking>;
  /** Lowercased object type names (eg `elementtag`) whose every tag is safe off-thread. */
  safeAllTypes: string[];
  /** Lowercased object type name -> safe sub-tag names. */
  safeSubTags: Record<string, string[]>;
  /** Tag bases that must be read on the main thread (eg `player`, `server`). */
  mainThreadBases: string[];
  /** Main-thread-only bases that are still free when written bare (eg `<player>`). */
  bareSafeBases: string[];
  /** Main-thread-only base -> sub-tags that are safe anyway (eg `server` -> flag tags + static data tags). */
  baseSafeSubTags: Record<string, string[]>;
  /** `owner/repo` of the sources that know about async safety; tags from other sources are judged conservatively. */
  awareRepos: string[];
  /** Lowercased object types DenizenM hands to the main thread (`markObjectTypeMainThreadOnly`), safe sub-tags aside. */
  mainThreadTypes?: string[];
  /** Lowercased pure-data object type -> the few tags on it that still go to the main thread (`markObjectTypeTagsMainThreadOnly`). */
  typeMainThreadTags?: Record<string, string[]>;
}

const NAME_TOKEN_RE = /^[a-z0-9_\-&]+(?:\(([a-z0-9_]+)\))?$/i;

export class AsyncSafetyCollector {
  private commands = new Map<string, AsyncCommandMarking>();
  private commentCmdRuns = new Set<string>();
  private commentCmdDefer = new Map<string, string>();
  private safeAll = new Set<string>();
  private safeSub = new Map<string, Set<string>>();
  private mainBases = new Set<string>();
  private bareBases = new Set<string>();
  private baseSub = new Map<string, Set<string>>();
  private awareRepos = new Set<string>();
  private mainTypes = new Set<string>();
  private typeTags = new Map<string, Set<string>>();
  private foundAny = false;

  /** Feed one Java file. Cheap for files with no markings (a few `includes` checks). */
  visitJavaFile(content: string, repo: string): void {
    let aware = false;
    if (content.includes('AbstractCommand') && content.includes('setName(')) {
      if (this.visitCommand(content)) aware = true;
    }
    if (content.includes('// @async')) {
      if (this.visitMapComments(content)) aware = true;
    }
    if (content.includes('MainThreadOnly(')) {
      if (this.visitBaseMarkings(content)) aware = true;
    }
    if (aware) {
      this.foundAny = true;
      if (repo) this.awareRepos.add(repo);
    }
  }

  private visitCommand(content: string): boolean {
    const nameMatch = /setName\(\s*"([^"]+)"\s*\)/.exec(content);
    if (!nameMatch) return false;
    const name = nameMatch[1].toLowerCase();
    const plainSafe = /\basyncSafe\s*=\s*true\b|setAsyncSafe\(\s*true\s*\)|setAsyncWaitable\(\s*true\s*\)/.test(content);
    const conditionalSafe = /public\s+boolean\s+isAsyncSafe\s*\(\s*ScriptEntry\b/.test(content);
    const deferrable =
      /\basyncDeferrable\s*=\s*true\b|setAsyncDeferrable\(\s*true\s*\)/.test(content) ||
      /public\s+boolean\s+isAsyncDeferrable\s*\(\s*ScriptEntry\b/.test(content);
    if (!plainSafe && !conditionalSafe && !deferrable) return false;
    this.commands.set(name, {
      runsAsync: plainSafe || conditionalSafe,
      runsAsyncConditional: !plainSafe && conditionalSafe ? true : undefined,
      deferrable,
    });
    return true;
  }

  private visitMapComments(content: string): boolean {
    const lines = content.split('\n');
    const entries: Array<{ kind: string; text: string }> = [];
    let current: { kind: string; text: string } | null = null;
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      const start = /^\s*\/\/\s*@(asyncsave|asyncbase|asynccmd)\s+(.*)$/.exec(line);
      if (start) {
        current = { kind: start[1], text: start[2].trim() };
        entries.push(current);
        continue;
      }
      const cont = /^\s*\/\/\s{2,}(\S.*)$/.exec(line);
      if (current && cont && !cont[1].startsWith('@')) {
        current.text += ' ' + cont[1].trim();
        continue;
      }
      current = null;
    }

    let used = false;
    for (const { kind, text } of entries) {
      const colon = text.indexOf(':');
      if (colon === -1) continue;
      const key = text.slice(0, colon).trim();
      const body = text.slice(colon + 1).trim();
      if (kind === 'asyncsave' && /^\(everything\)$|^everything$/i.test(body)) {
        this.safeAll.add(key.toLowerCase());
        used = true;
        continue;
      }
      const items = parseNameList(body);
      // Descriptive header lines ("runsAsync: commands an async queue can ...") are not name lists - skip them.
      if (!items) continue;
      used = true;
      if (kind === 'asyncsave') {
        const set = this.safeSub.get(key.toLowerCase()) || new Set<string>();
        for (const it of items) set.add(it.name);
        this.safeSub.set(key.toLowerCase(), set);
      } else if (kind === 'asyncbase') {
        const target = key === 'mainThreadOnly' ? this.mainBases : key === 'bareSafe' ? this.bareBases : null;
        if (target) for (const it of items) target.add(it.name);
      } else if (kind === 'asynccmd') {
        if (key === 'runsAsync') for (const it of items) this.commentCmdRuns.add(it.name);
        else if (key === 'deferrable') for (const it of items) this.commentCmdDefer.set(it.name, it.qualifier || '');
      }
    }
    return used;
  }

  private visitBaseMarkings(content: string): boolean {
    const stripped = stripJavaComments(content);
    const constants = parseStringArrayConstants(stripped);
    let used = false;

    // for (String objectBase : new String[] { "biome", "entity" }) { TagManager.markMainThreadOnly(objectBase, FLAG_TAGS); }
    const loopRe = /for\s*\(\s*String\s+(\w+)\s*:\s*new\s+String\s*\[\s*\]\s*\{([^}]*)\}\s*\)\s*\{?\s*TagManager\.markMainThreadOnly\(\s*\1\s*(,|\))/g;
    let m: RegExpExecArray | null;
    while ((m = loopRe.exec(stripped)) !== null) {
      const bases = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1].toLowerCase());
      const argsStart = m.index + m[0].length;
      const subTags = m[3] === ',' ? evalArgs(stripped, argsStart, constants) : [];
      for (const b of bases) this.addBase(b, subTags);
      used = true;
    }

    const callRe = /TagManager\.markMainThreadOnly\(\s*"([^"]+)"\s*(,|\))/g;
    while ((m = callRe.exec(stripped)) !== null) {
      const base = m[1].toLowerCase();
      const subTags = m[2] === ',' ? evalArgs(stripped, m.index + m[0].length, constants) : [];
      this.addBase(base, subTags);
      used = true;
    }

    // TagManager.markObjectTypeMainThreadOnly(EntityTag.class, ENTITY_ASYNC_SAFE_TAGS) - the safe sub-tags come from the
    // `@asyncsave` map comments; only the type itself is needed here.
    const typeRe = /TagManager\.markObjectTypeMainThreadOnly\(\s*(\w+)\.class\b/g;
    while ((m = typeRe.exec(stripped)) !== null) {
      this.mainTypes.add(m[1].toLowerCase());
      used = true;
    }

    // TagManager.markObjectTypeTagsMainThreadOnly(MaterialTag.class, "is_enabled")
    const typeTagsRe = /TagManager\.markObjectTypeTagsMainThreadOnly\(\s*(\w+)\.class\s*(,|\))/g;
    while ((m = typeTagsRe.exec(stripped)) !== null) {
      const type = m[1].toLowerCase();
      const tags = m[2] === ',' ? evalArgs(stripped, m.index + m[0].length, constants) : [];
      const set = this.typeTags.get(type) || new Set<string>();
      for (const t of tags) set.add(t.toLowerCase());
      this.typeTags.set(type, set);
      used = true;
    }

    const bareRe = /TagManager\.markBareBaseAsyncSafe\(\s*"([^"]+)"\s*\)/g;
    while ((m = bareRe.exec(stripped)) !== null) {
      this.bareBases.add(m[1].toLowerCase());
      used = true;
    }
    return used;
  }

  private addBase(base: string, subTags: string[]): void {
    this.mainBases.add(base);
    const set = this.baseSub.get(base) || new Set<string>();
    for (const t of subTags) set.add(t.toLowerCase());
    this.baseSub.set(base, set);
  }

  /** Returns null when no markings were found at all (eg custom `DENIZEN_SOURCES`), so callers keep the built-in fallback. */
  result(): AsyncSafetyData | null {
    if (!this.foundAny) return null;

    const commands: Record<string, AsyncCommandMarking> = {};
    const names = new Set([...this.commands.keys(), ...this.commentCmdRuns, ...this.commentCmdDefer.keys()]);
    for (const name of [...names].sort()) {
      const fromCode = this.commands.get(name);
      const runsAsync = (fromCode?.runsAsync ?? false) || this.commentCmdRuns.has(name);
      const deferrable = (fromCode?.deferrable ?? false) || this.commentCmdDefer.has(name);
      if (!runsAsync && !deferrable) continue;
      const qualifier = this.commentCmdDefer.get(name);
      commands[name] = {
        runsAsync,
        runsAsyncConditional: runsAsync && fromCode?.runsAsyncConditional ? true : undefined,
        deferrable,
        deferrableQualifier: deferrable && qualifier ? qualifier : undefined,
      };
    }

    const sortedRecord = (map: Map<string, Set<string>>): Record<string, string[]> => {
      const out: Record<string, string[]> = {};
      for (const key of [...map.keys()].sort()) out[key] = [...map.get(key)!].sort();
      return out;
    };

    return {
      commands,
      safeAllTypes: [...this.safeAll].sort(),
      safeSubTags: sortedRecord(this.safeSub),
      mainThreadBases: [...this.mainBases].sort(),
      bareSafeBases: [...this.bareBases].sort(),
      baseSafeSubTags: sortedRecord(this.baseSub),
      awareRepos: [...this.awareRepos].sort(),
      mainThreadTypes: [...this.mainTypes].sort(),
      typeMainThreadTags: sortedRecord(this.typeTags),
    };
  }
}

function parseNameList(body: string): Array<{ name: string; qualifier?: string }> | null {
  const parts = body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out: Array<{ name: string; qualifier?: string }> = [];
  for (const part of parts) {
    const m = NAME_TOKEN_RE.exec(part);
    if (!m) return null;
    const paren = part.indexOf('(');
    out.push({
      name: (paren === -1 ? part : part.slice(0, paren)).toLowerCase(),
      qualifier: m[1] ? m[1].toLowerCase() : undefined,
    });
  }
  return out;
}

function stripJavaComments(src: string): string {
  // Keeps string literals intact; good enough for the registry files this is used on.
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function parseStringArrayConstants(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /static\s+final\s+String\s*\[\s*\]\s+(\w+)\s*=\s*new\s+String\s*\[\s*\]\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.set(m[1], [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]));
  }
  return out;
}

/**
 * Evaluates the remaining arguments of a call starting at `start` (just after the first argument's comma),
 * understanding string literals, String[] constants, `withFlagTags(...)` and `withInheritedTags(Type.class, a, b)`.
 */
function evalArgs(src: string, start: number, constants: Map<string, string[]>): string[] {
  let pos = start;
  const skipWs = () => {
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  };

  const parseExpr = (): string[] => {
    skipWs();
    if (src[pos] === '"') {
      const end = src.indexOf('"', pos + 1);
      const val = src.slice(pos + 1, end);
      pos = end + 1;
      return [val];
    }
    const ident = /^[\w.]+/.exec(src.slice(pos, pos + 200));
    if (!ident) {
      pos++;
      return [];
    }
    const name = ident[0];
    pos += name.length;
    skipWs();
    if (src[pos] === '(') {
      pos++;
      const args = parseArgList();
      const fn = name.split('.').pop();
      if (fn === 'withFlagTags') return [...(constants.get('FLAG_TAGS') || []), ...args.flat()];
      if (fn === 'withInheritedTags') return args.slice(1).flat();
      if (fn === 'asList') return args.flat();
      return args.flat();
    }
    if (name.endsWith('.class')) return [];
    return constants.get(name.split('.').pop() || name) || [];
  };

  const parseArgList = (): string[][] => {
    const args: string[][] = [];
    skipWs();
    if (src[pos] === ')') {
      pos++;
      return args;
    }
    while (pos < src.length) {
      args.push(parseExpr());
      skipWs();
      if (src[pos] === ',') {
        pos++;
        continue;
      }
      if (src[pos] === ')') {
        pos++;
        break;
      }
      pos++;
    }
    return args;
  };

  return parseArgList().flat();
}

/** `https://github.com/owner/repo/archive/...zip` -> `owner/repo` */
export function repoFromSourceUrl(url: string): string {
  const m = /github\.com\/([^/]+\/[^/]+)/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}
