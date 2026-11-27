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
  escapeHtmlAttr,
  escapeQuickSimple,
  urlSafe,
} from './util';
import {
  highlight,
  htmlizeSyntax,
  htmlizeTags,
  parseAndEscape,
} from './highlighter';
import { createSeededRng, ExtraDataSets, loadExtraData, suggestExampleFor } from './meta-data';
import {
  getCommandAsyncStatus,
  getTagAsyncStatus,
  getObjectTypeAsyncStatus,
  describeAsyncSafetyMap,
  setAsyncSafetyData,
} from './async-safety';
import { AsyncSafetyCollector, repoFromSourceUrl } from './async-safety-parser';
import metaSources from '../../meta-sources.json';

// Single list shared with the auto-deploy workflow (scripts/check-sources.mjs).
export const DEFAULT_SOURCES: string[] = process.env.DENIZEN_SOURCES
  ? process.env.DENIZEN_SOURCES.split(',').map((s) => s.trim())
  : metaSources.sources;

const HTML_PREFIX = '<table class="table table-hover"><tbody>\n';
const HTML_SUFFIX = '</tbody></table>\n';

function tableLine(type: string, key: string, content: string, clean: boolean): string {
  if (!content) return '';
  const finalContent = clean ? parseAndEscape(content) : content;
  const rowClass =
    type === 'default'
      ? ''
      : type.startsWith('default ')
      ? type.slice(8)
      : `table-${type}`;
  return `<tr${rowClass ? ` class="${rowClass}"` : ''}><td class="td-doc-key">${key}</td><td>${finalContent}</td></tr>\n`;
}

function formatSourceLink(sourceUrl: string): string {
  if (!sourceUrl.startsWith('https://') && !sourceUrl.startsWith('http://')) {
    return escapeForHTML(sourceUrl);
  }
  const isGitHub = sourceUrl.includes('github.com');
  const safeUrl = urlSafe(sourceUrl);
  const btnText = isGitHub ? 'View on GitHub' : 'View Source';

  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="source-github-btn">${btnText}</a>`;
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

export function generateEventSample(line: string, extraData: ExtraDataSets, rng: () => number = Math.random): string {
  let sb = rng() > 0.4 ? 'after' : 'on';
  const parts = line.split(' ');
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    sb += ' ';
    if (part.endsWith(')')) {
      part = part.slice(0, -1);
    }
    if (part.startsWith('(')) {
      if (rng() > 0.5) {
        while (i < parts.length && !parts[i].endsWith(')')) {
          i++;
        }
        continue;
      } else {
        part = part.slice(1);
      }
    }
    if (part.startsWith('<') && part.endsWith('>')) {
      sb += suggestExampleFor(part.slice(1, -1), extraData, rng);
    } else if (part.includes('|')) {
      const options = part.split('|');
      sb += options[Math.floor(rng() * options.length)];
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

function examplifyTag(tag: string, returns: string, returnType?: MetaObjectTypeObject, rng: () => number = Math.random): string {
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
    const chosen = returnType.generatedReturnUsageExample[Math.floor(rng() * returnType.generatedReturnUsageExample.length)];
    return chosen.replace(/%VALUE%/g, tag);
  }
  return `- narrate ${tag}`;
}

export function generateTagExample(
  tag: MetaTagObject,
  objectTypes: Record<string, MetaObjectTypeObject>,
  rng: () => number = Math.random
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
      return examplifyTag(`<${baseText}>`, tag.returns, returnTypeObj, rng);
    }
    return examplifyTag(`<${baseText}.${parts[1].text}>`, tag.returns, returnTypeObj, rng);
  }

  const paramLabel = lastPart.parameter || '';
  let param: string | null = null;
  if (paramLabel === '<#>') {
    param = SAMPLE_INTEGERS[Math.floor(rng() * SAMPLE_INTEGERS.length)];
  } else if (paramLabel === '<#.#>') {
    param = SAMPLE_DECIMALS[Math.floor(rng() * SAMPLE_DECIMALS.length)];
  } else {
    const cleanParam = paramLabel.toLowerCase().replace(/[<>().,]/g, '');
    const inputType = objectTypes[cleanParam] || objectTypes[cleanParam + 'tag'];
    if (!inputType || !inputType.exampleValues || inputType.exampleValues.length === 0) {
      return null;
    }
    param = inputType.exampleValues[Math.floor(rng() * inputType.exampleValues.length)];
  }

  if (parts.length === 1) {
    return examplifyTag(`<${baseText}[${param}]>`, tag.returns, returnTypeObj, rng);
  }
  return examplifyTag(`<${baseText}.${parts[1].text}[${param}]>`, tag.returns, returnTypeObj, rng);
}

export function generateMechanismExample(
  mech: MetaMechanismObject,
  objectTypes: Record<string, MetaObjectTypeObject>,
  rng: () => number = Math.random
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
  const chosenParam = paramSet[Math.floor(rng() * paramSet.length)];
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
  sourceUrl: string,
  visitJavaFile?: (content: string) => void
): Array<{ type: string; url: string; pairs: Array<[string, string]> }> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const results: Array<{ type: string; url: string; pairs: Array<[string, string]> }> = [];

  for (const entry of entries) {
    if (!entry.entryName.endsWith('.java')) continue;
    const content = entry.getData().toString('utf8');
    visitJavaFile?.(content);
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
    const tagAsync = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned, tag.sourceFile);
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
    const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName, ot.sourceFile);
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
  const q = query.toLowerCase().trim();
  if (!q) return 0;

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

  // Multi-word token search (e.g. "item containers" matches "item script containers")
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    // Helpers are already lowercased by cleanList at build time.
    const checkAllWordsInSingleString = (list: string[], val: number): number => {
      if (list.some((s) => words.every((w) => s.includes(w)))) {
        return val;
      }
      return 0;
    };

    // If all words are present in perfectMatches (e.g. name / cleanName)
    score = checkAllWordsInSingleString(helpers.perfectMatches, 9);
    if (score > 0) return score;

    // If all words are present in synonyms
    score = checkAllWordsInSingleString(helpers.synonyms, 7);
    if (score > 0) return score;

    // If all words are present in strongs
    score = checkAllWordsInSingleString(helpers.strongs, 5);
    if (score > 0) return score;

    // If words match across combined metadata (name, synonyms, description) without string allocation
    const pools = [helpers.perfectMatches, helpers.synonyms, helpers.strongs, helpers.decents];
    if (words.every((w) => pools.some((p) => p.some((s) => s.includes(w))))) {
      // If at least one word matches the title/cleanName directly
      const hasTitleWord = helpers.perfectMatches.some((s) => words.some((w) => s.includes(w)));
      return hasTitleWord ? 7 : 4;
    }
  }

  return 0;
}

export async function loadAllMetaDocs(sources: string[] = DEFAULT_SOURCES, forceDownload = false): Promise<MetaDocsData> {
  const extraData = loadExtraData();
  const cacheDir = path.join(process.cwd(), 'cache');

  const rawBlocks: Array<{ type: string; url: string; pairs: Array<[string, string]> }> = [];
  const loadErrors: string[] = [];
  const asyncCollector = new AsyncSafetyCollector();
  const sourceCommits: Record<string, string> = {};

  for (const src of sources) {
    try {
      const hash = crypto.createHash('md5').update(src).digest('hex').slice(0, 10);
      const fileName = `${path.basename(src).replace('.zip', '')}-${hash}.zip`;
      const cachePath = path.join(cacheDir, fileName);
      const zipBuf = await downloadFile(src, cachePath, forceDownload);
      // GitHub stores the archived commit's SHA as the zip comment.
      const commit = new AdmZip(zipBuf).getZipComment().trim();
      if (/^[0-9a-f]{40}$/.test(commit)) sourceCommits[src] = commit;
      const repo = repoFromSourceUrl(src);
      const parsed = parseRawMetaBlocks(zipBuf, src, (content) => asyncCollector.visitJavaFile(content, repo));
      rawBlocks.push(...parsed);
    } catch (err: any) {
      console.error(`Error loading source ${src}:`, err);
      loadErrors.push(`Source download error ${src}: ${err.message}`);
    }
  }

  // Async-safety badges, filters and search keywords below all read this, so it must be applied first.
  const asyncSafety = asyncCollector.result();
  if (!asyncSafety) {
    console.warn('No async-safety markings found in the sources; using the built-in fallback table.');
  }
  setAsyncSafetyData(asyncSafety);

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
      description: describeAsyncSafetyMap(),
    };
  }

  // Precompute tag and mechanism counts per ObjectType for cross-linking
  const tagCountByType = new Map<string, number>();
  for (const t of Object.values(tags)) {
    const key = t.beforeDot.toLowerCase();
    tagCountByType.set(key, (tagCountByType.get(key) || 0) + 1);
  }
  const mechCountByType = new Map<string, number>();
  for (const m of Object.values(mechanisms)) {
    const key = m.mechObject.toLowerCase();
    mechCountByType.set(key, (mechCountByType.get(key) || 0) + 1);
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
    const aID = escapeHtmlAttr(obj.cleanName);
    const aHref = '#' + encodeURIComponent(obj.cleanName);

    switch (obj.type) {
      case 'Command': {
        const cmd = obj as MetaCommandObject;
        const asyncInfo = getCommandAsyncStatus(cmd.name);
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr('- ' + cmd.name)}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(cmd.name)}</span></a>`, false);
        html += tableLine('default', 'Async Status', `${asyncInfo.badgeHtml} <span class="badge-async-desc">${escapeForHTML(asyncInfo.descriptionText)}</span>`, false);
        if (cmd.guide) {
          // Only web links become clickable: a `javascript:` URL in a source comment must never run on the site.
          const guideHtml = /^https?:\/\//i.test(cmd.guide)
            ? `<a href="${escapeHtmlAttr(cmd.guide)}" target="_blank" rel="noopener noreferrer">${escapeForHTML(cmd.guide)}</a>`
            : escapeForHTML(cmd.guide);
          html += tableLine('default', 'Related Guide Page', guideHtml, false);
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
        const tagAsync = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned, tag.sourceFile);
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr(tag.tagFull)}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(tag.tagFull)}</span></a>`, false);
        html += tableLine('default', 'Async Safety', `${tagAsync.badgeHtml} <span class="badge-async-desc">${escapeForHTML(tagAsync.descriptionText)}</span>`, false);
        const returnBase = tag.returns ? tag.returns.split('(')[0] : '';
        html += tableLine('default tr-returns', 'Returns', `<a href="/Docs/ObjectTypes/${encodeURIComponent(returnBase.toLowerCase())}">${escapeForHTML(tag.returns)}</a>`, false);
        if (tag.mechanism) {
          html += tableLine('default', 'Mechanism', `<a href="/Docs/Mechanisms/${urlSafe(tag.mechanism)}">${escapeForHTML(tag.mechanism)}</a>`, false);
        }
        html += tableLine('default', 'Description', tag.description, true);
        for (const example of tag.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (tag.examples.length === 0) {
          const example = generateTagExample(tag, objectTypes, createSeededRng('tag:' + tag.cleanName));
          if (example) {
            const generatedWarning = 'title="This example is generated randomly based on the tag\'s format specification. Specific details such as item/entity type names may not actually be applicable to this tag."';
            html += tableLine('default slightly_smaller_text', `<abbr ${generatedWarning}>Generated Example</abbr>`, highlight(example), false);
          }
        }
        break;
      }

      case 'Event': {
        const evt = obj as MetaEventObject;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr('on ' + evt.cleanName + ':')}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(evt.cleanName)}</span></a>`, false);
        html += tableLine('secondary', 'Event Lines', evt.events.map(generateEventExplainer).join('\n<br>'), false);
        html += tableLine('default', 'Triggers', evt.triggers, true);
        for (const example of evt.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (evt.examples.length === 0 && evt.events.length > 0) {
          const generatedWarning = 'title="This example is generated randomly based on the event\'s format specification. Specific details such as item/entity type names may not actually be applicable to this event."';
          const rng1 = createSeededRng('evt1:' + evt.cleanName);
          const rng2 = createSeededRng('evt2:' + evt.cleanName);
          const sample1 = evt.events.map((e) => generateEventSample(e, extraData, rng1));
          const sample2 = evt.events.map((e) => generateEventSample(e, extraData, rng2));
          const uniqueSamples = Array.from(new Set([...sample1, ...sample2])).join('\n');
          html += tableLine('default smaller_text', `<abbr ${generatedWarning}>Generated Examples</abbr>`, highlight(uniqueSamples), false);
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
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr(mech.mechName)}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(mech.mechName)}</span></a>`, false);
        html += tableLine('default', 'Object', `<a href="/Docs/ObjectTypes/${encodeURIComponent(mech.mechObject.toLowerCase())}">${escapeForHTML(mech.mechObject)}</a>`, false);
        html += tableLine('default', 'Input', mech.input, true);
        html += tableLine('default', 'Related Tags', htmlizeTags(mech.tags, tagLookup), false);
        html += tableLine('default', 'Description', mech.description, true);
        for (const example of mech.examples) {
          html += tableLine('default', 'Example', highlight(example), false);
        }
        if (mech.examples.length === 0) {
          const example = generateMechanismExample(mech, objectTypes, createSeededRng('mech:' + mech.cleanName));
          if (example) {
            const generatedWarning = 'title="This example is generated randomly based on the tag\'s format specification. Specific details such as item/entity type names may not actually be applicable to this tag."';
            html += tableLine('default slightly_smaller_text', `<abbr ${generatedWarning}>Generated Example</abbr>`, highlight(example), false);
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
        html += tableLine('primary', 'Action Lines', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr(act.name + ':')}" class="doc-anchor-link">${fullNameText}</a>`, false);
        html += tableLine('default', 'Triggers', act.triggers, true);
        html += tableLine('default', 'Contexts', htmlizeTags(act.context, tagLookup), false);
        html += tableLine('default', 'Determine', act.determinations.join('\n'), true);
        break;
      }

      case 'Language': {
        const lang = obj as MetaLanguageObject;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr(lang.name)}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(lang.name)}</span></a>`, false);
        html += tableLine('default', 'Description', lang.description, true);
        break;
      }

      case 'ObjectType': {
        const ot = obj as MetaObjectTypeObject;
        const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName, ot.sourceFile);
        const linkObjType = (targetName: string) => `<a href="/Docs/ObjectTypes/${encodeURIComponent(targetName.toLowerCase())}">${escapeForHTML(targetName)}</a>`;
        html += tableLine('primary', 'Name', `<a id="${aID}" href="${aHref}" data-copy-text="${escapeHtmlAttr(ot.name)}" class="doc-anchor-link"><span class="doc_name">${escapeForHTML(ot.name)}</span></a>`, false);
        html += tableLine('default', 'Async Support', `${otAsync.badgeHtml} <span class="badge-async-desc">${escapeForHTML(otAsync.descriptionText)}</span>`, false);
        const tCount = tagCountByType.get(ot.cleanName) || 0;
        const mCount = mechCountByType.get(ot.cleanName) || 0;
        if (tCount > 0 || mCount > 0) {
          const links: string[] = [];
          if (tCount > 0) {
            links.push(`<a href="/Docs/Tags#${encodeURIComponent(ot.cleanName)}" class="obj-crosslink-badge">${tCount} ${escapeForHTML(ot.name)} ${tCount === 1 ? 'Tag' : 'Tags'} &rarr;</a>`);
          }
          if (mCount > 0) {
            links.push(`<a href="/Docs/Mechanisms#${encodeURIComponent(ot.cleanName + ' mechanisms')}" class="obj-crosslink-badge">${mCount} ${escapeForHTML(ot.name)} ${mCount === 1 ? 'Mechanism' : 'Mechanisms'} &rarr;</a>`);
          }
          html += tableLine('default', 'Members', links.join(' '), false);
        }
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
    obj.htmlContent = html
      .replace(/<\/pre>\s*(?:<br\s*\/?>\s*)+/gi, '</pre>\n')
      .replace(/(?:<br\s*\/?>\s*)+<pre>/gi, '\n<pre>');
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
    asyncSafety: asyncSafety || undefined,
    sourceCommits,
  };
}

const STRIPPED_OBJECT_KEYS = new Set([
  'rawValues',
  'parsedFormatParts',
  'overlyCleanedEvents',
  'cleanActions',
  'examples',
  'usages',
  'context',
  'determinations',
  'generatedReturnUsageExample',
]);

function stripBuildOnlyFields<T extends BaseMetaObject>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    const slim: Record<string, unknown> = {};
    for (const [prop, val] of Object.entries(v)) {
      if (STRIPPED_OBJECT_KEYS.has(prop)) continue;
      if (val === '' || val === undefined || (Array.isArray(val) && val.length === 0)) continue;
      slim[prop] = val;
    }
    out[k] = slim as T;
  }
  return out;
}

/**
 * Serializes MetaDocsData without duplicating all 3,978 objects inside `allObjects`
 * and strips build-time-only fields that are already baked into `htmlContent` / `searchHelper`.
 */
export function serializeMetaDocs(docs: MetaDocsData): string {
  return JSON.stringify({
    commands: stripBuildOnlyFields(docs.commands),
    tags: stripBuildOnlyFields(docs.tags),
    events: stripBuildOnlyFields(docs.events),
    mechanisms: stripBuildOnlyFields(docs.mechanisms),
    actions: stripBuildOnlyFields(docs.actions),
    languages: stripBuildOnlyFields(docs.languages),
    objectTypes: stripBuildOnlyFields(docs.objectTypes),
    loadErrors: docs.loadErrors,
    lastReload: docs.lastReload,
    asyncSafety: docs.asyncSafety,
    sourceCommits: docs.sourceCommits,
  });
}

function normalizeLoadedObject<T extends BaseMetaObject>(obj: T): T {
  if (!obj.synonyms) obj.synonyms = [];
  if (!obj.warnings) obj.warnings = [];
  if (!obj.group) obj.group = '';
  if (!obj.groupingString) obj.groupingString = '';
  if (!obj.searchHelper) {
    obj.searchHelper = { perfectMatches: [], synonyms: [], strongs: [], decents: [], backups: [] };
  } else {
    if (!obj.searchHelper.perfectMatches) obj.searchHelper.perfectMatches = [];
    if (!obj.searchHelper.synonyms) obj.searchHelper.synonyms = [];
    if (!obj.searchHelper.strongs) obj.searchHelper.strongs = [];
    if (!obj.searchHelper.decents) obj.searchHelper.decents = [];
    if (!obj.searchHelper.backups) obj.searchHelper.backups = [];
  }
  if (obj.type === 'Event' && !(obj as unknown as MetaEventObject).cleanEvents) {
    (obj as unknown as MetaEventObject).cleanEvents = [];
  }
  return obj;
}

/**
 * Rehydrates a parsed `denizen-meta.json` payload in memory, sharing object references
 * between per-kind dictionaries and `allObjects`.
 */
export function hydrateMetaDocs(raw: Partial<MetaDocsData>): MetaDocsData {
  // Runtime filters / page titles call the async helpers, so they must see the markings this file was built with.
  setAsyncSafetyData(raw.asyncSafety);
  const commands = raw.commands || {};
  const tags = raw.tags || {};
  const events = raw.events || {};
  const mechanisms = raw.mechanisms || {};
  const actions = raw.actions || {};
  const languages = raw.languages || {};
  const objectTypes = raw.objectTypes || {};

  const dicts = [commands, tags, events, mechanisms, actions, languages, objectTypes];
  const combined: AnyMetaObject[] = [];
  for (const dict of dicts) {
    for (const item of Object.values(dict)) {
      combined.push(normalizeLoadedObject(item as AnyMetaObject));
    }
  }

  combined.sort((a, b) => {
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

  return {
    commands,
    tags,
    events,
    mechanisms,
    actions,
    languages,
    objectTypes,
    allObjects: combined,
    loadErrors: raw.loadErrors || [],
    lastReload: raw.lastReload || '0',
    asyncSafety: raw.asyncSafety,
    sourceCommits: raw.sourceCommits,
  };
}
