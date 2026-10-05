import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import {
  AnyMetaObject,
  BaseMetaObject,
  MetaActionObject,
  MetaCommandObject,
  MetaDocsData,
  MetaEventObject,
  MetaLanguageObject,
  MetaMechanismObject,
  MetaObjectTypeObject,
  MetaTagObject,
  SearchableHelpers,
} from './types';
import {
  cleanTag,
  escapeForHTML,
  escapeQuickSimple,
  urlSafe,
} from './util';
import {
  highlight,
  htmlizeSyntax,
  htmlizeTags,
  parseAndEscape,
} from './highlighter';
import { ExtraDataSets, loadExtraData, suggestExampleFor } from './meta-data';
import {
  getCommandAsyncStatus,
  getTagAsyncStatus,
  getObjectTypeAsyncStatus,
} from './async-safety';

export const DEFAULT_SOURCES = process.env.DENIZEN_SOURCES
  ? process.env.DENIZEN_SOURCES.split(',').map((s) => s.trim())
  : [
      'https://github.com/Energobro/DenizenM-Tjtoxshpilivili1/archive/master.zip',
      'https://github.com/Energobro/DenizenM-Core/archive/main.zip',
      'https://github.com/DenizenScript/Depenizen/archive/master.zip',
      'https://github.com/DenizenScript/dDiscordBot/archive/master.zip',
    ];

const HTML_PREFIX = '<table class="table table-hover"><tbody>\n';
const HTML_SUFFIX = '</tbody></table>\n';

function tableLine(type: string, key: string, content: string, clean: boolean): string {
  if (!content) return '';
  const finalContent = clean ? parseAndEscape(content) : content;
  return `<tr class="table-${type}"><td class="td-doc-key">${key}</td><td>${finalContent}</td></tr>\n`;
}

function formatSourceLink(sourceUrl: string): string {
  if (!sourceUrl.startsWith('https://') && !sourceUrl.startsWith('http://')) {
    return escapeForHTML(sourceUrl);
  }
  const isGitHub = sourceUrl.includes('github.com');
  const safeUrl = urlSafe(sourceUrl);
  const btnText = isGitHub ? 'View on GitHub' : 'View Source';

  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="source-github-btn">` +
    `<svg class="source-github-icon" viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>` +
    `<span class="source-github-text">${btnText}</span>` +
    `<svg class="source-github-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>` +
  `</a>`;
}

function addHtmlEndParts(obj: BaseMetaObject): string {
  let res = '';
  if (obj.synonyms && obj.synonyms.length > 0) {
    res += tableLine('default text-muted smaller_text', 'Synonyms (Search Aid)', obj.synonyms.join(', '), true);
  }
  if (obj.group) {
    res += tableLine('default text-muted', 'Group', obj.group, true);
  }
  if (obj.plugin && obj.plugin.toLowerCase() !== 'paper') {
    res += tableLine('warning', 'Requires', obj.plugin, true);
  }
  if (obj.deprecated) {
    res += tableLine('danger', 'Deprecated', obj.deprecated, true);
  }
  if (obj.warnings && obj.warnings.length > 0) {
    res += tableLine('danger', 'Warning(s)', obj.warnings.join('\n'), true);
  }
  if (obj.sourceFile) {
    res += tableLine('secondary', 'Source', formatSourceLink(obj.sourceFile), false);
  }
  res += HTML_SUFFIX;
  return res;
}

export function generateEventExplainer(line: string): string {
  const parts = line.split(' ');
  let sb = '';
  let spans = 0;

  for (let parta of parts) {
    let part = parta;
    sb += ' ';
    if (part.startsWith('(')) {
      sb += '<span title="Optional input: you can exclude this part if you don\'t need it." class="syntax_optional">(';
      spans++;
      part = part.slice(1);
    }
    const isFillIn = part.startsWith('<');
    if (isFillIn) {
      sb += '<span title="Fill-in spot: supply a value of the correct type" class="syntax_fillable">&lt;';
      spans++;
      part = part.slice(1);
    }
    let afterPart = '';
    if (part.endsWith(')')) {
      afterPart = ')</span>';
      spans--;
      part = part.slice(0, -1);
    }
    if (part.endsWith('>')) {
      afterPart = '&gt;</span>' + afterPart;
      spans--;
      part = part.slice(0, -1);
    }
    part = escapeForHTML(part);
    if (part.includes('|')) {
      sb += `<span title="List of options: pick one" class="syntax_list">${part}</span>`;
    } else if (isFillIn) {
      if (part.includes("'")) {
        sb += `<abbr title="Fill-in spot for event-specific data" class="syntax_fillable">${part.replace(/'/g, '')}</abbr>`;
      } else {
        sb += `<abbr title="Fill-in spot: refer to event documentation" class="syntax_fillable">${part}</abbr>`;
      }
    } else {
      sb += part;
    }
    sb += afterPart;
  }
  for (let i = 0; i < spans; i++) {
    sb += '</span>';
  }
  return `<code><span class="syntax_command">${sb}</span></code>`;
}

export function generateEventSample(line: string, extraData: ExtraDataSets): string {
  let sb = Math.random() > 0.4 ? 'after' : 'on';
  const parts = line.split(' ');
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    sb += ' ';
    if (part.endsWith(')')) {
      part = part.slice(0, -1);
    }
    if (part.startsWith('(')) {
      if (Math.random() > 0.5) {
        while (i < parts.length && !parts[i].endsWith(')')) {
          i++;
        }
        continue;
      } else {
        part = part.slice(1);
      }
    }
    if (part.startsWith('<') && part.endsWith('>')) {
      sb += suggestExampleFor(part.slice(1, -1), extraData);
    } else if (part.includes('|')) {
      const options = part.split('|');
      sb += options[Math.floor(Math.random() * options.length)];
    } else {
      sb += part;
    }
  }
  let text = sb.trim();
  while (text.includes('  ')) {
    text = text.replace('  ', ' ');
  }
  return text + ':';
}

const SAMPLE_INTEGERS = ['1', '2', '3', '4'];
const SAMPLE_DECIMALS = ['1', '1.5', '2', '-1', '0'];

export function parseTagFormat(tag: string): Array<{ text: string; parameter?: string }> {
  let inner = tag.trim();
  if (inner.startsWith('<') && inner.endsWith('>')) {
    inner = inner.slice(1, -1);
  }
  const parts: Array<{ text: string; parameter?: string }> = [];
  let start = 0;
  let brackets = 0;
  let firstBracket = -1;
  let currentText = '';

  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '[') {
      brackets++;
      if (brackets === 1) {
        currentText = inner.slice(start, i).trim();
        firstBracket = i;
      }
    } else if (c === ']') {
      brackets--;
      if (brackets === 0 && firstBracket !== -1) {
        const param = inner.slice(firstBracket + 1, i);
        parts.push({ text: currentText, parameter: param });
        start = i + 1;
        firstBracket = -1;
        currentText = '';
      }
    } else if (c === '.' && brackets === 0) {
      if (start < i) {
        parts.push({ text: inner.slice(start, i).trim() });
      }
      start = i + 1;
    }
  }
  if (start < inner.length) {
    parts.push({ text: inner.slice(start).trim() });
  }
  return parts;
}

function examplifyTag(tag: string, returns: string, returnType?: MetaObjectTypeObject): string {
  const retLow = (returns || '').toLowerCase();
  switch (retLow) {
    case 'elementtag':
      return `- narrate ${tag}`;
    case 'objecttag':
      return `- narrate "debug - the object is: ${tag}"`;
    case 'elementtag(boolean)':
      return `- if ${tag}:\n    - narrate "it was true!"\n- else:\n    - narrate "it was false!"`;
    case 'elementtag(number)':
      return `- narrate "the number value is ${tag}"`;
    case 'elementtag(decimal)':
      return `- narrate "the decimal value is ${tag}"`;
  }
  if (returnType && returnType.generatedReturnUsageExample && returnType.generatedReturnUsageExample.length > 0) {
    const chosen = returnType.generatedReturnUsageExample[Math.floor(Math.random() * returnType.generatedReturnUsageExample.length)];
    return chosen.replace(/%VALUE%/g, tag);
  }
  return `- narrate ${tag}`;
}

export function generateTagExample(
  tag: MetaTagObject,
  objectTypes: Record<string, MetaObjectTypeObject>
): string | null {
  const parts = tag.parsedFormatParts || parseTagFormat(tag.tagFull);
  if (parts.length > 2 || parts.length === 0) {
    return null;
  }
  const baseTypeObj = objectTypes[tag.beforeDot.toLowerCase()];
  let baseText: string;
  if (!baseTypeObj) {
    baseText = parts[0].text;
  } else if (baseTypeObj.generatedExampleTagBase) {
    baseText = baseTypeObj.generatedExampleTagBase;
  } else {
    return null;
  }

  const returnTypeObj = objectTypes[(tag.returns || '').toLowerCase().split('(')[0]];

  const lastPart = parts[parts.length - 1];
  const requiresParam = parts.length === 1 ? tag.requiresParam : (lastPart.parameter !== undefined && !lastPart.parameter.endsWith(')'));

  if (!requiresParam) {
    if (parts.length === 1) {
      return examplifyTag(`<${baseText}>`, tag.returns, returnTypeObj);
    }
    return examplifyTag(`<${baseText}.${parts[1].text}>`, tag.returns, returnTypeObj);
  }

  const paramLabel = lastPart.parameter || '';
  let param: string | null = null;
  if (paramLabel === '<#>') {
    param = SAMPLE_INTEGERS[Math.floor(Math.random() * SAMPLE_INTEGERS.length)];
  } else if (paramLabel === '<#.#>') {
    param = SAMPLE_DECIMALS[Math.floor(Math.random() * SAMPLE_DECIMALS.length)];
  } else {
    const cleanParam = paramLabel.toLowerCase().replace(/[<>().,]/g, '');
    const inputType = objectTypes[cleanParam] || objectTypes[cleanParam + 'tag'];
    if (!inputType || !inputType.exampleValues || inputType.exampleValues.length === 0) {
      return null;
    }
    param = inputType.exampleValues[Math.floor(Math.random() * inputType.exampleValues.length)];
  }

  if (parts.length === 1) {
    return examplifyTag(`<${baseText}[${param}]>`, tag.returns, returnTypeObj);
  }
  return examplifyTag(`<${baseText}.${parts[1].text}[${param}]>`, tag.returns, returnTypeObj);
}

export function generateMechanismExample(
  mech: MetaMechanismObject,
  objectTypes: Record<string, MetaObjectTypeObject>
): string | null {
  const baseObjType = objectTypes[mech.mechObject.toLowerCase()];
  if (!baseObjType || !baseObjType.generatedExampleAdjust) {
    return null;
  }
  const input = (mech.input || '').toLowerCase();
  if (input === 'none') {
    return `- adjust ${baseObjType.generatedExampleAdjust} ${mech.mechName}`;
  }
  let paramSet: string[] | null = null;
  if (input === 'elementtag(boolean)') {
    paramSet = ['true', 'false'];
  } else if (input === 'elementtag(number)') {
    paramSet = SAMPLE_INTEGERS;
  } else if (input === 'elementtag(decimal)') {
    paramSet = SAMPLE_DECIMALS;
  } else {
    const inputObjType = objectTypes[input] || objectTypes[input + 'tag'];
    if (inputObjType && inputObjType.exampleValues && inputObjType.exampleValues.length > 0) {
      paramSet = inputObjType.exampleValues;
    }
  }

  if (!paramSet || paramSet.length === 0) {
    return null;
  }
  const chosenParam = paramSet[Math.floor(Math.random() * paramSet.length)];
  return `- adjust ${baseObjType.generatedExampleAdjust} ${mech.mechName}:${chosenParam}`;
}

function getCorrectURL(webSource: string, file: string, line: number): string {
  if (webSource.startsWith('https://github')) {
    const base = webSource.slice(0, -'.zip'.length).replace('/archive/', '/blob/');
    const slash = file.indexOf('/');
    const cleanFile = slash === -1 ? file : file.slice(slash + 1);
    return `${base}/${cleanFile}#L${line}`;
  }
  return `Web source ${webSource} file ${file} line ${line}`;
}

export async function downloadFile(url: string, destPath: string, forceDownload = false): Promise<Buffer> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!forceDownload && fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    // Cache for at most 5 minutes when not forcing reload
    if (Date.now() - stat.mtimeMs < 5 * 60 * 1000 && stat.size > 1000) {
      return fs.readFileSync(destPath);
    }
  }
  console.log(`Downloading fresh source from ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DenizenMetaScanner/1.0',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    if (fs.existsSync(destPath)) {
      console.warn(`Download failed for ${url} (${res.status}), using fallback cached zip.`);
      return fs.readFileSync(destPath);
    }
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  fs.writeFileSync(destPath, buf);
  return buf;
}

export function parseRawMetaBlocks(
  zipBuffer: Buffer,
  sourceUrl: string
): Array<{ type: string; url: string; pairs: Array<[string, string]> }> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const results: Array<{ type: string; url: string; pairs: Array<[string, string]> }> = [];

  for (const entry of entries) {
    if (!entry.entryName.endsWith('.java')) continue;
    const content = entry.getData().toString('utf8');
    const lines = content.split('\n');

    let inMeta = false;
    let metaType = '';
    let startLine = 0;
    let curKey: string | null = null;
    let curVal: string | null = null;
    let pairs: Array<[string, string]> = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].replace(/\r/g, '');
      const trimmedStart = rawLine.trimStart();
      if (!trimmedStart.startsWith('//')) continue;
      // Strip '//' or '// ', but PRESERVE all subsequent spaces (indentation)
      let line = trimmedStart.length === 2 ? '' : (trimmedStart.startsWith('// ') ? trimmedStart.slice(3) : trimmedStart.slice(2));

      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('<--[') && trimmedLine.endsWith(']')) {
        if (inMeta) {
          if (curKey !== null && curVal !== null) {
            pairs.push([curKey.toLowerCase(), curVal.trim()]);
          }
          if (pairs.length > 0) {
            results.push({
              type: metaType,
              url: getCorrectURL(sourceUrl, entry.entryName, startLine),
              pairs,
            });
          }
        }
        inMeta = true;
        metaType = trimmedLine.slice(4, -1).toLowerCase();
        startLine = i + 1;
        pairs = [];
        curKey = null;
        curVal = null;
      } else if (inMeta) {
        if (trimmedLine === '-->') {
          if (curKey !== null && curVal !== null) {
            pairs.push([curKey.toLowerCase(), curVal.trim()]);
          }
          results.push({
            type: metaType,
            url: getCorrectURL(sourceUrl, entry.entryName, startLine),
            pairs,
          });
          inMeta = false;
          metaType = '';
          curKey = null;
          curVal = null;
        } else if (trimmedLine.startsWith('@')) {
          if (curKey !== null && curVal !== null) {
            pairs.push([curKey.toLowerCase(), curVal.trim()]);
          }
          const space = trimmedLine.indexOf(' ');
          if (space === -1) {
            curKey = trimmedLine.slice(1);
            curVal = '';
            if (curKey === 'end_meta') {
              inMeta = false;
              results.push({
                type: metaType,
                url: getCorrectURL(sourceUrl, entry.entryName, startLine),
                pairs,
              });
              curKey = null;
              curVal = null;
            }
          } else {
            curKey = trimmedLine.slice(1, space);
            const keyToken = '@' + curKey;
            const keyIndex = line.indexOf(keyToken);
            curVal = keyIndex !== -1 ? line.slice(keyIndex + keyToken.length + 1) : trimmedLine.slice(space + 1);
          }
        } else {
          if (curVal !== null) {
            curVal += '\n' + line;
          }
        }
      }
    }
  }

  return results;
}

export function buildSearchables(obj: BaseMetaObject): SearchableHelpers {
  const perfectMatches: string[] = [obj.cleanName, obj.name];
  const synonyms: string[] = [...(obj.synonyms || [])];
  const strongs: string[] = [];
  if (obj.group) strongs.push(obj.group);
  const decents: string[] = [...(obj.warnings || [])];
  const backups: string[] = [];
  if (obj.sourceFile) backups.push(obj.sourceFile);

  if (obj.type === 'Command') {
    const cmd = obj as MetaCommandObject;
    if (cmd.short) strongs.push(cmd.short);
    if (cmd.description) decents.push(cmd.description);
    if (cmd.usages) backups.push(...cmd.usages);
    if (cmd.syntax) {
      backups.push(cmd.syntax);
      if (cmd.syntax.toLowerCase().includes('(async)')) {
        synonyms.push('async');
      }
    }
    if (cmd.guide) backups.push(cmd.guide);
    const asyncInfo = getCommandAsyncStatus(cmd.name);
    if (asyncInfo.runsAsync || asyncInfo.deferrable) {
      if (!synonyms.includes('async')) synonyms.push('async');
      if (!synonyms.includes('async-safe')) synonyms.push('async-safe');
      if (!synonyms.includes('asyncsafe')) synonyms.push('asyncsafe');
      if (!synonyms.includes('off-thread')) synonyms.push('off-thread');
      strongs.push(asyncInfo.descriptionText);
    }
  } else if (obj.type === 'Tag') {
    const tag = obj as MetaTagObject;
    if (tag.beforeDot && tag.beforeDot.toLowerCase().endsWith('tag')) {
      const untaggedPrefix = tag.beforeDot.slice(0, -'tag'.length);
      const untaggedFull = untaggedPrefix + '.' + tag.afterDotCleaned;
      perfectMatches.push(untaggedFull);
      perfectMatches.push('<' + untaggedFull + '>');
      synonyms.push(untaggedPrefix);
    }
    const tagAsync = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned);
    if (tagAsync.isSafe) {
      if (!synonyms.includes('async')) synonyms.push('async');
      if (!synonyms.includes('async-safe')) synonyms.push('async-safe');
      if (!synonyms.includes('asyncsafe')) synonyms.push('asyncsafe');
      if (!synonyms.includes('off-thread')) synonyms.push('off-thread');
      strongs.push(tagAsync.descriptionText);
    }
    if (tag.description) decents.push(tag.description);
    if (tag.mechanism) backups.push(tag.mechanism);
    if (tag.returns) backups.push(tag.returns);
  } else if (obj.type === 'Event') {
    const evt = obj as MetaEventObject;
    if (evt.events) perfectMatches.push(...evt.events);
    if (evt.triggers) strongs.push(evt.triggers);
    if (evt.context) decents.push(...evt.context);
    if (evt.determinations) decents.push(...evt.determinations);
    if (evt.npc) backups.push('NPC: ' + evt.npc);
    if (evt.player) backups.push('Player: ' + evt.player);
  } else if (obj.type === 'Mechanism') {
    const mech = obj as MetaMechanismObject;
    if (mech.mechName) perfectMatches.push(mech.mechName);
    if (mech.mechObject) strongs.push(mech.mechObject);
    if (mech.input) decents.push(mech.input);
    if (mech.description) decents.push(mech.description);
    if (mech.tags) backups.push(...mech.tags);
  } else if (obj.type === 'Action') {
    const act = obj as MetaActionObject;
    if (act.actions) perfectMatches.push(...act.actions);
    if (act.triggers) strongs.push(act.triggers);
    if (act.context) decents.push(...act.context);
    if (act.determinations) decents.push(...act.determinations);
  } else if (obj.type === 'Language') {
    const lang = obj as MetaLanguageObject;
    if (lang.description) decents.push(lang.description);
  } else if (obj.type === 'ObjectType') {
    const ot = obj as MetaObjectTypeObject;
    if (ot.prefix) strongs.push(ot.prefix);
    if (ot.description) decents.push(ot.description);
    if (ot.format) backups.push(ot.format);
    const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName);
    if (otAsync.isFullSafe || otAsync.isPartial) {
      if (!synonyms.includes('async')) synonyms.push('async');
      if (!synonyms.includes('async-safe')) synonyms.push('async-safe');
      strongs.push(otAsync.descriptionText);
    }
  }

  const cleanList = (list: string[]) =>
    list
      .filter((s) => s && typeof s === 'string')
      .map((s) => s.toLowerCase());

  return {
    perfectMatches: cleanList(perfectMatches),
    synonyms: cleanList(synonyms),
    strongs: cleanList(strongs),
    decents: cleanList(decents),
    backups: cleanList(backups),
  };
}

export function getMatchQuality(helpers: SearchableHelpers, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();

  const check = (list: string[], val: number): number => {
    if (list.includes(q)) return val;
    if (list.some((s) => s.includes(q))) return val - 1;
    return 0;
  };

  let score = check(helpers.perfectMatches, 10);
  if (score > 0) return score;

  score = check(helpers.synonyms, 8);
  if (score > 0) return score;

  score = check(helpers.strongs, 6);
  if (score > 0) return score;

  score = check(helpers.decents, 4);
  if (score > 0) return score;

  score = check(helpers.backups, 2);
  if (score > 0) return score;

  return 0;
}

export async function loadAllMetaDocs(sources: string[] = DEFAULT_SOURCES, forceDownload = false): Promise<MetaDocsData> {
  const extraData = loadExtraData();
  const cacheDir = path.join(process.cwd(), 'cache');

  const rawBlocks: Array<{ type: string; url: string; pairs: Array<[string, string]> }> = [];
  const loadErrors: string[] = [];

  for (const src of sources) {
    try {
      const hash = crypto.createHash('md5').update(src).digest('hex').slice(0, 10);
      const fileName = `${path.basename(src).replace('.zip', '')}-${hash}.zip`;
      const cachePath = path.join(cacheDir, fileName);
      const zipBuf = await downloadFile(src, cachePath, forceDownload);
      const parsed = parseRawMetaBlocks(zipBuf, src);
      rawBlocks.push(...parsed);
    } catch (err: any) {
      console.error(`Error loading source ${src}:`, err);
      loadErrors.push(`Source download error ${src}: ${err.message}`);
    }
  }

  const commands: Record<string, MetaCommandObject> = {};
  const tags: Record<string, MetaTagObject> = {};
  const events: Record<string, MetaEventObject> = {};
  const mechanisms: Record<string, MetaMechanismObject> = {};
  const actions: Record<string, MetaActionObject> = {};
  const languages: Record<string, MetaLanguageObject> = {};
  const objectTypes: Record<string, MetaObjectTypeObject> = {};

  const extensions: Array<{
    targetType: string;
    targetName: string;
    name: string;
    includeExisting: boolean;
    pairs: Array<[string, string]>;
  }> = [];

  for (const block of rawBlocks) {
    const map = new Map<string, string[]>();
    for (const [k, v] of block.pairs) {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(v);
    }

    const getFirst = (k: string) => map.get(k)?.[0] || '';
    const getAll = (k: string) => map.get(k) || [];

    const baseObj = {
      group: getFirst('group') || '',
      synonyms: getAll('synonyms').flatMap((s) => s.split(',').map((x) => x.trim().toLowerCase())).filter(Boolean),
      warnings: getAll('warning'),
      plugin: (() => {
        const p = getFirst('plugin');
        return p && p.trim().toLowerCase() !== 'paper' ? p.trim() : undefined;
      })(),
      deprecated: getFirst('deprecated') || undefined,
      sourceFile: block.url,
      rawValues: Object.fromEntries(map.entries()),
      searchHelper: { perfectMatches: [], synonyms: [], strongs: [], decents: [], backups: [] },
      htmlContent: '',
      groupingString: '',
    };

    switch (block.type) {
      case 'command': {
        const name = getFirst('name');
        if (!name) break;
        const clean = name.toLowerCase();
        const syntax = getFirst('syntax');
        const short = getFirst('short');
        const desc = getFirst('description');
        const cmdTags = getFirst('tags').split('\n').filter(Boolean);
        const usages = getAll('usage');
        const guide = getFirst('guide') || undefined;

        const cmdObj: MetaCommandObject = {
          ...baseObj,
          type: 'Command',
          name,
          cleanName: clean,
          searchName: name,
          commandName: name,
          required: parseInt(getFirst('required')) || 0,
          maximum: parseInt(getFirst('maximum')) || 999999,
          syntax,
          short,
          description: desc,
          tags: cmdTags,
          usages,
          guide,
          groupingString: baseObj.group || 'Commands',
        };
        commands[clean] = cmdObj;
        break;
      }

      case 'tag': {
        const tagFull = getFirst('attribute');
        if (!tagFull) break;
        const cleaned = cleanTag(tagFull);
        const clean = cleaned.toLowerCase();
        const beforeDot = cleaned.includes('.') && !cleaned.startsWith('&') ? cleaned.slice(0, cleaned.indexOf('.')) : 'Base';
        const afterDotCleaned = clean.includes('.') ? clean.slice(clean.indexOf('.') + 1) : clean;
        const returns = getFirst('returns');
        const desc = getFirst('description');
        const mech = getFirst('mechanism') || undefined;
        const tagExamples = getAll('example');
        const parsedFormatParts = parseTagFormat(tagFull);
        const firstPart = parsedFormatParts.length === 1 ? parsedFormatParts[0] : parsedFormatParts[1];
        const allowsParam = firstPart ? firstPart.parameter !== undefined : false;
        const requiresParam = allowsParam && !firstPart.parameter!.endsWith(')');

        const tagObj: MetaTagObject = {
          ...baseObj,
          type: 'Tag',
          name: tagFull,
          cleanName: clean,
          searchName: tagFull,
          tagFull,
          cleanedName: clean,
          beforeDot,
          afterDotCleaned,
          returns,
          description: desc,
          mechanism: mech,
          examples: tagExamples,
          allowsParam,
          requiresParam,
          parsedFormatParts,
          groupingString: beforeDot,
        };
        tags[clean] = tagObj;
        break;
      }

      case 'event': {
        const evtLines = getFirst('events').split('\n').filter(Boolean);
        if (evtLines.length === 0) break;
        const name = evtLines[0];
        const clean = name.toLowerCase().replace(/[<>'()]/g, '');
        const triggers = getFirst('triggers');
        const context = getFirst('context').split('\n').filter(Boolean);
        const determinations = getFirst('determine').split('\n').filter(Boolean);
        const switches: string[] = [];
        const switchNames: string[] = [];
        for (const sw of getAll('switch')) {
          for (const s of sw.split('\n').filter(Boolean)) {
            switches.push(s);
            const swName = s.split(' ')[0].split(':')[0].toLowerCase();
            switchNames.push(swName);
          }
        }

        const evtObj: MetaEventObject = {
          ...baseObj,
          type: 'Event',
          name,
          cleanName: clean,
          searchName: clean,
          events: evtLines,
          cleanEvents: evtLines.map((s) => s.toLowerCase().replace(/[<>'()]/g, '')),
          overlyCleanedEvents: evtLines.map((s) => s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[<>'()]/g, '').trim()),
          triggers,
          context,
          determinations,
          player: getFirst('player') || undefined,
          npc: getFirst('npc') || undefined,
          cancellable: getFirst('cancellable').trim().toLowerCase() === 'true',
          hasLocation: getFirst('location').trim().toLowerCase() === 'true',
          examples: getAll('example'),
          switches,
          switchNames,
          groupingString: baseObj.group || 'Events',
        };
        events[clean] = evtObj;
        break;
      }

      case 'mechanism': {
        const mechObjName = getFirst('object');
        const mechName = getFirst('name');
        if (!mechObjName || !mechName) break;
        const fullName = `${mechObjName}.${mechName}`;
        const clean = fullName.toLowerCase();
        const input = getFirst('input');
        const desc = getFirst('description');
        const mechTags = getFirst('tags').split('\n').filter(Boolean);
        const mechExamples = getAll('example');

        const mechObj: MetaMechanismObject = {
          ...baseObj,
          type: 'Mechanism',
          name: fullName,
          cleanName: clean,
          searchName: fullName,
          fullName,
          mechObject: mechObjName,
          mechName,
          input,
          description: desc,
          tags: mechTags,
          examples: mechExamples,
          groupingString: `${mechObjName} Mechanisms`,
        };
        mechanisms[clean] = mechObj;
        break;
      }

      case 'property': {
        const propObj = getFirst('object');
        const propName = getFirst('name');
        if (!propObj || !propName) break;
        const fullName = `${propObj}.${propName}`;
        const input = getFirst('input');
        const desc = getFirst('description');
        const asTag = `<${fullName}>`;
        const cleanedTagStr = cleanTag(asTag);
        const clean = cleanedTagStr.toLowerCase();
        const beforeDot = cleanedTagStr.includes('.') ? cleanedTagStr.slice(0, cleanedTagStr.indexOf('.')) : propObj;
        const afterDot = clean.includes('.') ? clean.slice(clean.indexOf('.') + 1) : propName.toLowerCase();
        const hasControls = desc.startsWith('Controls');
        const cleanedDesc = hasControls ? desc.slice('Controls'.length) : desc;

        // Auto Mechanism
        const mechClean = fullName.toLowerCase();
        const mechObj: MetaMechanismObject = {
          ...baseObj,
          type: 'Mechanism',
          name: fullName,
          cleanName: mechClean,
          searchName: fullName,
          fullName,
          mechObject: propObj,
          mechName: propName,
          input,
          description: `(Property) ${hasControls ? 'Sets' : ''}${cleanedDesc}`,
          tags: [asTag],
          examples: getAll('example'),
          groupingString: baseObj.group || `${propObj} Mechanisms`,
        };
        mechanisms[mechClean] = mechObj;

        // Auto Tag
        const tagObj: MetaTagObject = {
          ...baseObj,
          type: 'Tag',
          name: asTag,
          cleanName: clean,
          searchName: asTag,
          tagFull: asTag,
          cleanedName: clean,
          beforeDot,
          afterDotCleaned: afterDot,
          returns: input,
          description: `(Property) ${hasControls ? 'Returns' : ''}${cleanedDesc}`,
          mechanism: fullName,
          examples: getAll('example'),
          allowsParam: false,
          requiresParam: false,
          groupingString: beforeDot,
        };
        tags[clean] = tagObj;
        break;
      }

      case 'action': {
        const actionLines = getFirst('actions').split('\n').filter(Boolean);
        if (actionLines.length === 0) break;
        const name = actionLines[0];
        const clean = name.toLowerCase();
        const triggers = getFirst('triggers');
        const context = getFirst('context').split('\n').filter(Boolean);
        const determinations = getFirst('determine').split('\n').filter(Boolean);

        const actObj: MetaActionObject = {
          ...baseObj,
          type: 'Action',
          name,
          cleanName: clean,
          searchName: name,
          actions: actionLines,
          cleanActions: actionLines.map((s) => s.toLowerCase()),
          triggers,
          context,
          determinations,
          groupingString: 'NPC Actions',
        };
        actions[clean] = actObj;
        break;
      }

      case 'language': {
        const name = getFirst('name');
        if (!name) break;
        const clean = name.toLowerCase();
        const desc = getFirst('description');

        const langObj: MetaLanguageObject = {
          ...baseObj,
          type: 'Language',
          name,
          cleanName: clean,
          searchName: name,
          langName: name,
          description: desc,
          groupingString: baseObj.group || 'Language',
        };
        languages[clean] = langObj;
        break;
      }

      case 'objecttype': {
        const name = getFirst('name');
        if (!name) break;
        const clean = name.toLowerCase();
        const prefix = getFirst('prefix').toLowerCase();
        const baseTypeName = getFirst('base');
        const format = getFirst('format');
        const desc = getFirst('description');
        const implementsNames = getFirst('implements').replace(/ /g, '').split(',').filter(Boolean);
        const exampleValues = getFirst('examplevalues').replace(/ /g, '').split(',').filter(Boolean);

        const otObj: MetaObjectTypeObject = {
          ...baseObj,
          type: 'ObjectType',
          name,
          cleanName: clean,
          searchName: name,
          typeName: name,
          prefix,
          baseTypeName,
          format,
          description: desc,
          implementsNames,
          exampleValues,
          generatedExampleTagBase: getFirst('exampletagbase') || undefined,
          generatedExampleAdjust: getFirst('exampleadjustobject') || (getFirst('exampletagbase') ? `<${getFirst('exampletagbase')}>` : undefined),
          generatedReturnUsageExample: getAll('exampleforreturns'),
          matchable: getFirst('matchable') || undefined,
          groupingString: format === 'N/A' ? 'Pseudo ObjectType' : (!baseObj.plugin ? 'Core' : 'External'),
        };
        objectTypes[clean] = otObj;
        break;
      }

      case 'extension': {
        const targetType = getFirst('target_type');
        const targetName = getFirst('target_name');
        const name = getFirst('name');
        const includeExisting = getFirst('include_existing').toLowerCase() !== 'false';
        if (targetType && targetName) {
          extensions.push({
            targetType,
            targetName,
            name,
            includeExisting,
            pairs: block.pairs,
          });
        }
        break;
      }
    }
  }

  // Helper for tag lookup with down-typing (PlayerTag/NPCTag -> EntityTag) and prefix normalization
  const findTag = (rawTag: string): MetaTagObject | null => {
    const cleaned = cleanTag(rawTag).toLowerCase();
    if (tags[cleaned]) {
      return tags[cleaned];
    }
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex > 0) {
      const tagBase = cleaned.slice(0, dotIndex);
      let secondarySearch: string | null = null;
      if (tagBase === 'playertag' || tagBase === 'npctag') {
        secondarySearch = 'entitytag' + cleaned.slice(dotIndex);
      } else if (!tagBase.endsWith('tag')) {
        secondarySearch = tagBase + 'tag' + cleaned.slice(dotIndex);
      }
      if (secondarySearch) {
        return findTag(secondarySearch);
      }
    }
    return null;
  };

  const tagLookup = (rawTag: string) => {
    const found = findTag(rawTag);
    if (found) {
      return { cleanedName: found.cleanedName, description: found.description };
    }
    return null;
  };

  if (!languages['async tag safety map']) {
    const mapName = 'Async Tag Safety Map';
    languages['async tag safety map'] = {
      type: 'Language',
      name: mapName,
      cleanName: 'async tag safety map',
      searchName: mapName,
      langName: mapName,
      group: 'Tag System',
      groupingString: 'Tag System',
      synonyms: ['async', 'async safety', 'asynccmd', 'asyncsave', 'thread safety', 'performance'],
      warnings: [],
      sourceFile: 'https://github.com/Energobro/DenizenM-Tjtoxshpilivili1/blob/master/plugin/src/main/java/com/denizenscript/denizen/utilities/CommonRegistries.java',
      rawValues: {
        name: [mapName],
        group: ['Tag System'],
      },
      searchHelper: { perfectMatches: [], synonyms: [], strongs: [], decents: [], backups: [] },
      htmlContent: '',
      description: `Complete machine-readable mapping of DenizenM Async Safety for commands, tag bases, and object types.\n\n` +
        `=== ASYNC COMMAND MAP ===\n` +
        `Commands an async queue can run directly on its own thread (44 commands):\n` +
        `actionbar, announce, async, choose, debug, debug-invalid-command, debugblock, define, definemap, determine, draw, else, filecopy, fileread, filewrite, flag, foreach, goto, if, image, inject, log, mark, narrate, playeffect, playsound, random, ratelimit, redis, repeat, run, schematic, sidebar, sql, stop, tablist, title, toast, wait, waituntil, webget, webserver, while, yaml.\n\n` +
        `Deferrable commands (can be dispatched to main thread without stalling the async script):\n` +
        `actionbar(per_player), announce, compass, fakeequip, narrate(per_player), playeffect, playsound, runlater(id), showfake, sidebar(per_player).\n\n` +
        `=== ASYNC TAG SAFETY MAP ===\n` +
        `Object types where 100% of tags are safe off the main thread (pure data / immutable objects):\n` +
        `BiomeTag, PluginTag, TradeTag, BinaryTag, ColorTag, CustomObjectTag, DurationTag, ElementTag, ImageTag, JavaReflectedObjectTag, ListTag, MapTag, QuaternionTag, QueueTag, ScriptTag, SecretTag, TimeTag.\n\n` +
        `Object types safe with minor exceptions:\n` +
        `- EnchantmentTag: safe except full_name, can_enchant\n` +
        `- MaterialTag: safe except is_enabled\n\n` +
        `Object types with specific async-safe sub-tags:\n` +
        `- ChunkTag: add, cuboid, is_loaded, simple, sub, world, x, xz, z\n` +
        `- CuboidTag: center, contains, contains_cuboid, contains_location, corners, flag, flag_expiration, flag_map, get_outline, has_flag, intersects, is_within, list_flags, max, min, outline, outline_2d, shell, shift, size, volume, walls, with_max, with_min\n` +
        `- EllipsoidTag: add, bounding_box, chunks, contains, contains_location, flag, flag_expiration, flag_map, has_flag, include, is_within, list_flags, location, random, shell, size, with_location, with_size, world\n` +
        `- EntityTag: entity_type, script, translated_name, type, uuid\n` +
        `- InventoryTag: (none)\n` +
        `- ItemTag: book_author, book_map, book_pages, book_title, display, durability, enchantment_map, enchantment_types, enchantments, flag, flag_expiration, flag_map, has_display, has_flag, has_lore, is_enchanted, list_flags, lore, material, max_stack, quantity, script, with_flag\n` +
        `- LocationTag: above, add, backward, backward_flat, below, center, chunk, distance, distance_squared, div, down, format, formatted, forward, forward_flat, get_chunk, left, mul, normalize, pitch, points_around_x, points_around_y, points_around_z, points_between, quaternion_between_vectors, random_offset, raw, relative, right, rotate_around_x, rotate_around_y, rotate_around_z, rotate_pitch, rotate_yaw, round, round_down, round_to, round_to_precision, round_up, simple, simplex_3d, sub, to_axis_angle_quaternion, up, vector_length, vector_length_squared, vector_to_face, with_pitch, with_x, with_y, with_yaw, with_z, world, x, xyz, y, yaw, z\n` +
        `- NPCTag: (none)\n` +
        `- PlayerTag: ban_created, ban_created_time, ban_expiration, ban_expiration_time, ban_info, ban_reason, ban_source, chat_history, chat_history_list, disguise_to_self, fake_block, fake_block_locations, fake_entities, first_played, first_played_time, flag, flag_expiration, flag_map, has_flag, has_played_before, is_banned, is_online, is_op, is_player, is_whitelisted, last_played, last_played_time, list_flags, name, sidebar_lines, sidebar_scores, sidebar_title, uuid, whitelisted\n` +
        `- PolygonTag: bounding_box, contains, contains_inclusive, contains_location, corners, flag, flag_expiration, flag_map, has_flag, include_y, is_within, list_flags, max_y, min_y, outline, outline_2d, shell, shell_inclusive, shift, with_corner, with_y_max, with_y_min, world\n` +
        `- WorldTag: allows_animals, allows_monsters, allows_pvp, ambient_spawn_limit, animal_spawn_limit, auto_save, can_generate_structures, difficulty, duration_since_created, environment, hardcore, has_storm, is_day, is_night, keep_spawn, max_height, min_height, monster_spawn_limit, moon_phase, name, sea_level, seed, simulation_distance, sky_darkness, thunder_duration, thundering, ticks_per_animal_spawn, ticks_per_monster_spawn, time, time_duration, time_full, time_period, view_distance, water_animal_spawn_limit, weather_duration, world_type\n\n` +
        `=== TAG BASES ===\n` +
        `- mainThreadOnly: biome, chunk, cuboid, ellipsoid, enchantment, entity, inventory, item, plugin, polygon, trade, world, player, server, npc\n` +
        `- bareSafe: player, npc (reading bare <player> hands back the queue's linked object with 0 hand-offs)\n` +
        `- notMarked: location, material, and all core data types (list, map, element, time, duration, queue, script, secret, binary, color, customobject, image, javareflectedobject, quaternion)`,
    };
  }

  // Compile all objects
  const allObjects: AnyMetaObject[] = [
    ...Object.values(commands),
    ...Object.values(tags),
    ...Object.values(events),
    ...Object.values(mechanisms),
    ...Object.values(actions),
    ...Object.values(languages),
    ...Object.values(objectTypes),
  ];

  // Build searchables and HTML for each object
  for (const obj of allObjects) {
    obj.searchHelper = buildSearchables(obj);

    let html = HTML_PREFIX;
    const aID = escapeForHTML(obj.cleanName);

    switch (obj.type) {
      case 'Command': {
        const cmd = obj as MetaCommandObject;
        const asyncInfo = getCommandAsyncStatus(cmd.name);
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(cmd.name)}</span></a>`, false);
        html += tableLine('default', 'Async Status', `${asyncInfo.badgeHtml} <span class="text-xs text-slate-500 dark:text-slate-400 ml-1.5 align-middle">${escapeForHTML(asyncInfo.descriptionText)}</span>`, false);
        if (cmd.guide) {
          html += tableLine('default', 'Related Guide Page', `<a href="${escapeForHTML(cmd.guide)}">${escapeForHTML(cmd.guide)}</a>`, false);
        }
        html += tableLine('default', 'Syntax', htmlizeSyntax(cmd.syntax), false);
        html += tableLine('default', 'Short Description', cmd.short, true);
        html += tableLine('default', 'Full Description', cmd.description, true);
        html += tableLine('default', 'Related Tags', htmlizeTags(cmd.tags, tagLookup), false);
        for (const usage of cmd.usages) {
          html += tableLine('default', 'Usage Example', highlight('# ' + usage), false);
        }
        break;
      }

      case 'Tag': {
        const tag = obj as MetaTagObject;
        const tagAsync = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned);
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(tag.tagFull)}</span></a>`, false);
        html += tableLine('default', 'Async Safety', `${tagAsync.badgeHtml} <span class="text-xs text-slate-500 dark:text-slate-400 ml-1.5 align-middle">${escapeForHTML(tagAsync.descriptionText)}</span>`, false);
        const returnBase = tag.returns ? tag.returns.split('(')[0] : '';
        html += tableLine('default tr-returns', 'Returns', `<a href="/Docs/ObjectTypes/${escapeForHTML(returnBase)}">${escapeForHTML(tag.returns)}</a>`, false);
        if (tag.mechanism) {
          html += tableLine('default', 'Mechanism', `<a href="/Docs/Mechanisms/${urlSafe(tag.mechanism)}">${escapeForHTML(tag.mechanism)}</a>`, false);
        }
        html += tableLine('default', 'Description', tag.description, true);
        for (const example of tag.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (tag.examples.length === 0) {
          const example = generateTagExample(tag, objectTypes);
          if (example) {
            const generatedWarning = 'title="This example is generated randomly based on the tag\'s format specification. Specific details such as item/entity type names may not actually be applicable to this tag."';
            html += tableLine('default slightly_smaller_text', `<abbr ${generatedWarning}>Generated Example</abbr>`, `<span ${generatedWarning}>${highlight(example)}</span>`, false);
          }
        }
        break;
      }

      case 'Event': {
        const evt = obj as MetaEventObject;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(evt.cleanName)}</span></a>`, false);
        html += tableLine('secondary', 'Event Lines', evt.events.map(generateEventExplainer).join('\n<br>'), false);
        html += tableLine('default', 'Triggers', evt.triggers, true);
        for (const example of evt.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (evt.examples.length === 0 && evt.events.length > 0) {
          const generatedWarning = 'title="This example is generated randomly based on the event\'s format specification. Specific details such as item/entity type names may not actually be applicable to this event."';
          const sample1 = evt.events.map((e) => generateEventSample(e, extraData));
          const sample2 = evt.events.map((e) => generateEventSample(e, extraData));
          const uniqueSamples = Array.from(new Set([...sample1, ...sample2])).join('\n');
          html += tableLine('default smaller_text', `<abbr ${generatedWarning}>Generated Examples</abbr>`, `<span ${generatedWarning}>${highlight(uniqueSamples)}</span>`, false);
        }
        if (evt.player) {
          html += tableLine('default', 'Has Player', evt.player + " - this adds switches 'flagged:<flag name>' + 'permission:<node>', in addition to the '<player>' link.", true);
        }
        if (evt.npc) {
          html += tableLine('default', 'Has NPC', evt.npc, true);
        }
        if (evt.switches.length > 0) {
          html += tableLine('default', 'Switches', evt.switches.join('\n'), true);
        }
        if (evt.context.length > 0) {
          html += tableLine('default', 'Contexts', htmlizeTags(evt.context, tagLookup), false);
        }
        if (evt.determinations.length > 0) {
          html += tableLine('default', 'Determine', evt.determinations.join('\n'), true);
        }
        if (evt.cancellable) {
          html += tableLine('default', 'Cancellable', "True - This adds <context.cancelled> and determine 'cancelled' or 'cancelled:false'", true);
        }
        if (evt.hasLocation) {
          html += tableLine('default', 'Has Location', "True - This adds the switches 'in:<area>', 'location_flagged:<flag>', ...", true);
        }
        break;
      }

      case 'Mechanism': {
        const mech = obj as MetaMechanismObject;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(mech.mechName)}</span></a>`, false);
        html += tableLine('default', 'Object', `<a href="/Docs/ObjectTypes/${escapeForHTML(mech.mechObject)}">${escapeForHTML(mech.mechObject)}</a>`, false);
        html += tableLine('default', 'Input', mech.input, true);
        html += tableLine('default', 'Related Tags', htmlizeTags(mech.tags, tagLookup), false);
        html += tableLine('default', 'Description', mech.description, true);
        for (const example of mech.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (mech.examples.length === 0) {
          const example = generateMechanismExample(mech, objectTypes);
          if (example) {
            const generatedWarning = 'title="This example is generated randomly based on the tag\'s format specification. Specific details such as item/entity type names may not actually be applicable to this tag."';
            html += tableLine('default slightly_smaller_text', `<abbr ${generatedWarning}>Generated Example</abbr>`, `<span ${generatedWarning}>${highlight(example)}</span>`, false);
          }
        }
        break;
      }

      case 'Action': {
        const act = obj as MetaActionObject;
        let fullNameText = '';
        if (act.actions.length > 1) {
          fullNameText = `<span class="doc_name">${escapeForHTML(act.name)}</span>\n<br>` + act.actions.slice(1).map(escapeForHTML).join('\n<br>');
        } else {
          fullNameText = `<span class="doc_name">${escapeForHTML(act.name)}</span>`;
        }
        html += tableLine('primary', 'Action Lines', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)">${fullNameText}</a>`, false);
        html += tableLine('default', 'Triggers', act.triggers, true);
        html += tableLine('default', 'Contexts', htmlizeTags(act.context, tagLookup), false);
        html += tableLine('default', 'Determine', act.determinations.join('\n'), true);
        break;
      }

      case 'Language': {
        const lang = obj as MetaLanguageObject;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(lang.name)}</span></a>`, false);
        html += tableLine('default', 'Description', lang.description, true);
        break;
      }

      case 'ObjectType': {
        const ot = obj as MetaObjectTypeObject;
        const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName);
        const linkObjType = (targetName: string) => `<a href="/Docs/ObjectTypes/${escapeForHTML(targetName.toLowerCase())}">${escapeForHTML(targetName)}</a>`;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="#${aID}" onclick="doFlashFor('${aID}', event)"><span class="doc_name">${escapeForHTML(ot.name)}</span></a>`, false);
        html += tableLine('default', 'Async Support', `${otAsync.badgeHtml} <span class="text-xs text-slate-500 dark:text-slate-400 ml-1.5 align-middle">${escapeForHTML(otAsync.descriptionText)}</span>`, false);
        html += tableLine('default', 'Prefix', ot.prefix === 'none' ? 'None' : `${ot.prefix}@`, true);
        if (ot.baseTypeName && ot.baseTypeName.toLowerCase() !== 'none') {
          html += tableLine('default', 'Base Type', linkObjType(ot.baseTypeName), false);
        }
        if (ot.implementsNames.length > 0) {
          html += tableLine('default', 'Implements', ot.implementsNames.map(linkObjType).join(', '), false);
        }
        html += tableLine('default', 'Identity Format', ot.format, true);
        html += tableLine('default', 'Description', ot.description, true);
        if (ot.matchable) {
          html += tableLine('default', 'Matchable', ot.matchable, true);
        }
        break;
      }
    }

    html += addHtmlEndParts(obj);
    obj.htmlContent = html;
  }

  // Sort objects inside lists
  const sortObjs = <T extends BaseMetaObject>(list: T[]): T[] => {
    return [...list].sort((a, b) => {
      const aPlugin = a.plugin ? 1 : 0;
      const bPlugin = b.plugin ? 1 : 0;
      if (aPlugin !== bPlugin) return aPlugin - bPlugin;

      const aWarn = a.warnings ? a.warnings.length : 0;
      const bWarn = b.warnings ? b.warnings.length : 0;
      if (aWarn !== bWarn) return aWarn - bWarn;

      const aGroup = a.group || '';
      const bGroup = b.group || '';
      if (aGroup !== bGroup) {
        if (!aGroup) return -1;
        if (!bGroup) return 1;
        const grpCmp = aGroup.localeCompare(bGroup);
        if (grpCmp !== 0) return grpCmp;
      }

      return a.cleanName.localeCompare(b.cleanName);
    });
  };

  const sortRecord = <T extends BaseMetaObject>(rec: Record<string, T>): Record<string, T> => {
    const sorted = sortObjs(Object.values(rec));
    const res: Record<string, T> = {};
    for (const item of sorted) {
      res[item.cleanName] = item;
    }
    return res;
  };

  const sortedAll = sortObjs(allObjects);

  return {
    commands: sortRecord(commands),
    tags: sortRecord(tags),
    events: sortRecord(events),
    mechanisms: sortRecord(mechanisms),
    actions: sortRecord(actions),
    languages: sortRecord(languages),
    objectTypes: sortRecord(objectTypes),
    allObjects: sortedAll,
    loadErrors,
    lastReload: new Date().toISOString(),
  };
}
