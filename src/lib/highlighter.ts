import { escapeForHTML, escapeQuickSimple, urlSafe } from './util';

const CHAR_TAG_START = '\u0001';
const CHAR_TAG_END = '\u0002';

const CommentHeaderChars = new Set(['|', '+', '=', '#', '_', '@', '/']);
const DefiniteNotScriptKeys = new Set([
  'interact scripts',
  'default constants',
  'data',
  'constants',
  'text',
  'lore',
  'aliases',
  'slots',
  'enchantments',
  'input',
]);

const IfOperators = new Set([
  CHAR_TAG_START,
  CHAR_TAG_END,
  CHAR_TAG_START + '=',
  CHAR_TAG_END + '=',
  '==',
  '!=',
  '||',
  '&amp;&amp;',
  '(',
  ')',
  'or',
  'and',
  'not',
  'in',
  'contains',
  '!in',
  '!contains',
  'matches',
  '!matches',
]);

const IfCommandLabels = new Set(['cmd:if', 'cmd:else', 'cmd:while', 'cmd:waituntil']);
const DeffableCommandLabels = new Set(['cmd:run', 'cmd:runlater', 'cmd:clickable', 'cmd:bungeerun']);
const VALID_TAG_FIRST_CHAR = /^[a-zA-Z0-9&_\[]$/;

export function highlight(text: string): string {
  if (!text) return '<pre><code></code></pre>';
  const cleaned = text.replace(/^\r?\n+|\r?\n+$/g, '');
  const escaped = escapeForHTML(cleaned);
  const colored = colorScript(escaped);
  return `<pre><code>${colored}</code></pre>`;
}

export function colorScript(text: string): string {
  const lines: (string | null)[] = text.split('\n');
  let lastKey = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line === null) continue;

    const trimmedStart = line.trimStart();
    const trimmed = trimmedStart.trimEnd();

    if (trimmed.endsWith(':') && !trimmed.startsWith('-')) {
      lastKey = trimmed.slice(0, -1).toLowerCase();
    }

    if (trimmed.startsWith('-') && !trimmed.endsWith(':')) {
      const spaces = line.length - trimmedStart.length;
      while (i + 1 < lines.length) {
        const line2 = lines[i + 1];
        if (line2 === null) break;
        const trimmedStart2 = line2.trimStart();
        const spaces2 = line2.length - trimmedStart2.length;
        const trimmed2 = trimmedStart2.trimEnd();
        if (spaces2 > spaces && !trimmedStart2.startsWith('- ')) {
          line += '\n' + line2;
          lines[i] = null;
          i++;
          if (trimmed2.endsWith(':')) {
            break;
          }
        } else {
          break;
        }
      }
    }
    lines[i] = colorLine(line, lastKey);
  }

  return lines.filter((l): l is string => l !== null).join('\n');
}

export function colorLine(line: string, lastKey: string): string {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const trimmedEnd = line.trimEnd();
  if (trimmedEnd.length !== line.length) {
    return colorLine(trimmedEnd, lastKey) + `<span class="script_bad_space">${line.slice(trimmedEnd.length)}</span>`;
  }
  const preSpaces = line.length - trimmed.length;

  if (trimmed.startsWith('#')) {
    const afterComment = trimmed.slice(1).trim();
    if (afterComment.length > 0) {
      if (CommentHeaderChars.has(afterComment[0])) {
        return `<span class="script_comment_header">${line}</span>`;
      }
      if (afterComment.toLowerCase().startsWith('todo')) {
        return `<span class="script_comment_todo">${line}</span>`;
      }
      if (afterComment[0] === '-') {
        return `<span class="script_comment_code">${line}</span>`;
      }
    }
    return `<span class="script_comment_normal">${line}</span>`;
  }

  if (trimmed.startsWith('-')) {
    let result = `<span class="script_normal">${line.slice(0, preSpaces + 1)}</span>`;
    if (DefiniteNotScriptKeys.has(lastKey)) {
      result += colorArgument(line.slice(preSpaces + 1), false, 'non-script');
      return result;
    }
    const appendColon = trimmed.endsWith(':');
    let workingTrimmed = appendColon ? trimmed.slice(0, -1) : trimmed;
    const afterDash = workingTrimmed.slice(1);
    if (afterDash.length !== 0) {
      const commandEnd = afterDash.indexOf(' ', 1);
      const commandText = commandEnd === -1 ? afterDash : afterDash.slice(0, commandEnd);
      if (!afterDash.startsWith(' ')) {
        result += `<span class="script_bad_space">${commandText}</span>`;
        if (commandEnd !== -1) {
          result += colorArgument(afterDash.slice(commandEnd), false, 'cmd:' + commandText.trim());
        }
      } else {
        if (commandText.includes("'") || commandText.includes('"') || commandText.includes('[')) {
          result += colorArgument(afterDash, false, 'non-cmd');
        } else {
          result += `<span class="script_command">${commandText}</span>`;
          if (commandEnd > 0) {
            result += colorArgument(afterDash.slice(commandEnd), true, 'cmd:' + commandText.trim());
          }
        }
      }
    }
    if (appendColon) {
      result += '<span class="script_colon">:</span>';
    }
    return result;
  }

  if (line.endsWith(':')) {
    return `<span class="script_key">${line.slice(0, -1)}</span><span class="script_colon">:</span>`;
  }

  const colonIndex = line.indexOf(':');
  if (colonIndex !== -1) {
    const key = line.slice(0, colonIndex);
    return `<span class="script_key">${key}</span><span class="script_colon">:</span>${colorArgument(line.slice(colonIndex + 1), false, 'key:' + key)}`;
  }

  return `<span class="script_bad_space">${line}</span>`;
}

export function checkIfHasTagEnd(arg: string, initialQuoted: boolean, initialQuoteMode: string, canQuote: boolean): boolean {
  let paramCount = 0;
  let quoted = initialQuoted;
  let quoteMode = initialQuoteMode;

  for (let i = 0; i < arg.length; i++) {
    const c = arg[i];
    if (canQuote && (c === '"' || c === "'")) {
      if (quoted && c === quoteMode) {
        quoted = false;
      } else if (!quoted) {
        quoted = true;
        quoteMode = c;
      }
    } else if (c === '[') {
      paramCount++;
    } else if (c === ']' && paramCount > 0) {
      paramCount--;
    } else if (c === CHAR_TAG_END) {
      return true;
    }
  }
  return false;
}

export function colorTag(tag: string): string {
  let output = '';
  let inTagCounter = 0;
  let tagStart = 0;
  let inTagParamCounter = 0;
  let defaultColor = 'tag';
  let lastColor = 0;

  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (c === CHAR_TAG_START) {
      inTagCounter++;
      if (inTagCounter === 1) {
        output += `<span class="script_${defaultColor}">${tag.slice(lastColor, i)}</span>`;
        output += `<span class="script_tag">${CHAR_TAG_START}</span>`;
        lastColor = i + 1;
        defaultColor = 'tag';
        tagStart = i;
      }
    } else if (c === CHAR_TAG_END && inTagCounter > 0) {
      inTagCounter--;
      if (inTagCounter === 0) {
        output += colorTag(tag.slice(tagStart + 1, i));
        output += `<span class="script_tag">${tag.slice(i, i + 1)}</span>`;
        defaultColor = inTagParamCounter > 0 ? 'tag_param' : 'tag';
        lastColor = i + 1;
      }
    } else if (c === '[' && inTagCounter === 0) {
      inTagParamCounter++;
      if (inTagParamCounter === 1) {
        output += `<span class="script_${defaultColor}">${tag.slice(lastColor, i)}</span><span class="script_tag_param_bracket">[</span>`;
        lastColor = i + 1;
        defaultColor = i === 0 ? 'def_name' : 'tag_param';
      }
    } else if (c === ']' && inTagCounter === 0) {
      inTagParamCounter--;
      if (inTagParamCounter === 0) {
        output += `<span class="script_${defaultColor}">${tag.slice(lastColor, i)}</span><span class="script_tag_param_bracket">]</span>`;
        defaultColor = 'tag';
        lastColor = i + 1;
      }
    } else if ((c === '.' || c === '|') && inTagCounter === 0 && inTagParamCounter === 0) {
      output += `<span class="script_${defaultColor}">${tag.slice(lastColor, i)}</span>`;
      lastColor = i + 1;
      output += `<span class="script_tag_dot">${tag.slice(i, i + 1)}</span>`;
    }
  }

  if (lastColor < tag.length) {
    output += `<span class="script_${defaultColor}">${tag.slice(lastColor)}</span>`;
  }
  return output;
}

export function colorArgument(arg: string, canQuote: boolean, contextualLabel: string): string {
  arg = arg.replace(/&lt;/g, CHAR_TAG_START).replace(/&gt;/g, CHAR_TAG_END);
  let output = '';
  let quoted = false;
  let quoteMode = 'x';
  let inTagCounter = 0;
  let tagStart = 0;
  const referenceDefault = contextualLabel === 'key:definitions' ? 'def_name' : 'normal';
  let defaultColor = referenceDefault;
  let lastColor = 0;
  let hasTagEnd = checkIfHasTagEnd(arg, false, 'x', canQuote);
  let spaces = 0;

  for (let i = 0; i < arg.length; i++) {
    const c = arg[i];
    if (canQuote && (c === '"' || c === "'")) {
      if (quoted && c === quoteMode) {
        output += `<span class="script_${defaultColor}">${arg.slice(lastColor, i + 1)}</span>`;
        lastColor = i + 1;
        defaultColor = referenceDefault;
        quoted = false;
      } else if (!quoted) {
        output += `<span class="script_${defaultColor}">${arg.slice(lastColor, i)}</span>`;
        lastColor = i;
        quoted = true;
        defaultColor = c === '"' ? 'quote_double' : 'quote_single';
        quoteMode = c;
      }
    } else if (hasTagEnd && c === CHAR_TAG_START && i + 1 < arg.length && VALID_TAG_FIRST_CHAR.test(arg[i + 1])) {
      inTagCounter++;
      if (inTagCounter === 1) {
        output += `<span class="script_${defaultColor}">${arg.slice(lastColor, i)}</span>`;
        output += `<span class="script_tag">${CHAR_TAG_START}</span>`;
        lastColor = i + 1;
        tagStart = i;
        defaultColor = 'tag';
      }
    } else if (hasTagEnd && c === CHAR_TAG_END && inTagCounter > 0) {
      inTagCounter--;
      if (inTagCounter === 0) {
        output += colorTag(arg.slice(tagStart + 1, i));
        output += `<span class="script_tag">${arg.slice(i, i + 1)}</span>`;
        defaultColor = quoted ? (quoteMode === '"' ? 'quote_double' : 'quote_single') : referenceDefault;
        lastColor = i + 1;
      }
    } else if (inTagCounter === 0 && c === '|' && contextualLabel === 'key:definitions') {
      output += `<span class="script_${defaultColor}">${arg.slice(lastColor, i)}</span><span class="script_normal">|</span>`;
      lastColor = i + 1;
    } else if (inTagCounter === 0 && c === ':' && DeffableCommandLabels.has(contextualLabel)) {
      const part = arg.slice(lastColor, i);
      if (part.startsWith('def.') && !part.includes('<') && !part.includes(' ')) {
        output += `<span class="script_${defaultColor}">def.</span><span class="script_def_name">${arg.slice(lastColor + 'def.'.length, i)}</span>`;
        lastColor = i;
      }
    } else if (c === ' ' && !quoted && canQuote && inTagCounter === 0) {
      hasTagEnd = checkIfHasTagEnd(arg.slice(i + 1), quoted, quoteMode, canQuote);
      output += `<span class="script_${defaultColor}">${arg.slice(lastColor, i)}</span> `;
      lastColor = i + 1;
      if (!quoted) {
        inTagCounter = 0;
        defaultColor = referenceDefault;
        spaces++;
      }
      const nextSpace = arg.indexOf(' ', i + 1);
      const nextArg = nextSpace === -1 ? arg.slice(i + 1) : arg.slice(i + 1, nextSpace);
      if (!quoted && canQuote) {
        if (IfOperators.has(nextArg) && IfCommandLabels.has(contextualLabel)) {
          output += `<span class="script_colon">${arg.slice(i + 1, i + 1 + nextArg.length)}</span>`;
          i += nextArg.length;
          lastColor = i + 1;
        } else if (nextArg.startsWith('as:') && !nextArg.includes('<') && (contextualLabel === 'cmd:foreach' || contextualLabel === 'cmd:repeat')) {
          output += `<span class="script_normal">as:</span><span class="script_def_name">${arg.slice(i + 1 + 'as:'.length, i + 1 + nextArg.length)}</span>`;
          i += nextArg.length;
          lastColor = i + 1;
        } else if (nextArg.startsWith('key:') && !nextArg.includes('<') && contextualLabel === 'cmd:foreach') {
          output += `<span class="script_normal">key:</span><span class="script_def_name">${arg.slice(i + 1 + 'key:'.length, i + 1 + nextArg.length)}</span>`;
          i += nextArg.length;
          lastColor = i + 1;
        } else if (spaces === 1 && (contextualLabel === 'cmd:define' || contextualLabel === 'cmd:definemap')) {
          let colonIndex = nextArg.indexOf(':');
          if (colonIndex === -1) colonIndex = nextArg.length;
          const tagMark = nextArg.indexOf('<');
          if (tagMark === -1 || tagMark > colonIndex) {
            output += `<span class="script_def_name">${arg.slice(i + 1, i + 1 + colonIndex)}</span>`;
            i += colonIndex;
            lastColor = i + 1;
            const argStart = nextArg[0];
            if (!quoted && canQuote && (argStart === '"' || argStart === "'")) {
              quoted = true;
              defaultColor = argStart === '"' ? 'quote_double' : 'quote_single';
              quoteMode = argStart;
            }
          }
        }
      }
    }
  }

  if (lastColor < arg.length) {
    output += `<span class="script_${defaultColor}">${arg.slice(lastColor)}</span>`;
  }
  return output.replace(new RegExp(CHAR_TAG_START, 'g'), '&lt;').replace(new RegExp(CHAR_TAG_END, 'g'), '&gt;');
}

export function htmlizeSyntax(syntax: string): string {
  if (!syntax) return '';
  const firstSpace = syntax.indexOf(' ');
  const cmd = firstSpace === -1 ? syntax : syntax.slice(0, firstSpace);
  const rest = firstSpace === -1 ? '' : syntax.slice(firstSpace + 1);

  let output = `<span class="syntax_command">${escapeForHTML(cmd)}</span> `;
  let spans = 0;

  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    switch (c) {
      case '<':
        spans++;
        output += '<span class="syntax_fillable">&lt;';
        break;
      case '>':
        spans--;
        output += '&gt;</span>';
        break;
      case '{':
        spans++;
        output += '<span class="syntax_default">{';
        break;
      case '}':
        spans--;
        output += '}</span>';
        break;
      case '[':
        spans++;
        output += '<span class="syntax_required">[';
        break;
      case ']':
        spans--;
        output += ']</span>';
        break;
      case '(':
        spans++;
        output += '<span class="syntax_optional">(';
        break;
      case ')':
        spans--;
        output += ')</span>';
        break;
      case '&':
        output += '&amp;';
        break;
      case ':':
        output += '<span class="syntax_colon">:</span>';
        break;
      case '.':
      case '|':
      case '/':
        output += `<span class="syntax_list">${c}</span>`;
        break;
      default:
        output += c;
        break;
    }
  }

  for (let i = 0; i < spans; i++) {
    output += '</span>';
  }
  if (spans < 0) {
    return `<b>(ERROR: SPAN MISALIGN ${spans})</b>`;
  }
  return `<code>${output}</code>`;
}

export function parseLinksHelper(content: string): string {
  if (!content) return '';
  const linkStart = content.indexOf('<@link');
  if (linkStart === -1) {
    return escapeQuickSimple(content);
  }
  let tagMarks = 0;
  let linkEnd = -1;
  for (let i = linkStart + 1; i < content.length; i++) {
    if (content[i] === '<') {
      tagMarks++;
    } else if (content[i] === '>') {
      if (tagMarks === 0) {
        linkEnd = i;
        break;
      }
      tagMarks--;
    }
  }
  if (linkEnd === -1) {
    return escapeQuickSimple(content);
  }

  const rawLinkContent = content.slice(linkStart + '<@link '.length, linkEnd);
  const spaceIdx = rawLinkContent.indexOf(' ');
  const linkType = (spaceIdx === -1 ? rawLinkContent : rawLinkContent.slice(0, spaceIdx)).toLowerCase();
  const linkTarget = spaceIdx === -1 ? '' : rawLinkContent.slice(spaceIdx + 1);

  const escapedName = escapeForHTML(linkTarget);
  const targetName = urlSafe(linkTarget);

  let prefix = '';
  let fixedLink = '';

  switch (linkType) {
    case 'url':
      if (targetName.startsWith('https://')) {
        prefix = '<span title="External Link">&#x1f517;</span>';
        fixedLink = `<a class="meta_link_anchor" href="${targetName}">${escapedName}</a>`;
      } else {
        prefix = '';
        fixedLink = 'Link Blocked';
      }
      break;
    case 'command':
      prefix = 'Command:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Commands/${targetName}">${escapedName}</a>`;
      break;
    case 'tag':
      prefix = 'Tag:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Tags/${targetName}">${escapedName}</a>`;
      break;
    case 'event':
      prefix = 'Event:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Events/${targetName}">${escapedName}</a>`;
      break;
    case 'mechanism':
      prefix = 'Mechanism:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Mechanisms/${targetName}">${escapedName}</a>`;
      break;
    case 'action':
      prefix = 'Action:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Actions/${targetName}">${escapedName}</a>`;
      break;
    case 'language':
      prefix = 'Language:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Languages/${targetName}">${escapedName}</a>`;
      break;
    case 'objecttype':
      prefix = 'ObjectType:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/ObjectTypes/${targetName}">${escapedName}</a>`;
      break;
    case 'property':
      prefix = 'Property:';
      fixedLink = `<a class="meta_link_anchor" href="/Docs/Mechanisms/${targetName}">${escapedName}</a>`;
      break;
    default:
      prefix = '';
      fixedLink = 'Error Invalid Link';
      break;
  }

  const preText = escapeQuickSimple(content.slice(0, linkStart));
  const postText = parseLinksHelper(content.slice(linkEnd + 1));
  const linkedSpan = prefix
    ? `<span class="meta_link_badge"><span class="meta_url">${prefix}</span>${fixedLink}</span>`
    : fixedLink;
  return `${preText}${linkedSpan}${postText}`;
}

export function parseAndEscape(content: string): string {
  if (!content) return '';
  const codeBlockStart = content.indexOf('<code>');
  if (codeBlockStart === -1) {
    return parseLinksHelper(content);
  }
  const codeBlockEnd = content.indexOf('</code>', codeBlockStart);
  if (codeBlockEnd === -1) {
    return parseLinksHelper(content);
  }
  const beforeRaw = content.slice(0, codeBlockStart).replace(/\r?\n+$/, '');
  const beforeBlock = parseLinksHelper(beforeRaw);
  const code = highlight(content.slice(codeBlockStart + '<code>'.length, codeBlockEnd));
  const afterRaw = content.slice(codeBlockEnd + '</code>'.length).replace(/^\r?\n+/, '');
  const afterBlock = parseAndEscape(afterRaw);
  return `${beforeBlock}${code}${afterBlock}`;
}

export function htmlizeTags(
  tags: string[],
  tagLookup?: (cleanedName: string) => { cleanedName: string; description: string } | null
): string {
  if (!tags || tags.length === 0) return '';
  let output = '';
  for (const tag of tags) {
    const space = tag.indexOf(' ');
    const tagName = space === -1 ? tag : tag.slice(0, space);
    const tagExtra = space === -1 ? '' : tag.slice(space + 1);

    const properName = `<code>${colorArgument(escapeForHTML(tagName), false, 'meta-hl')}</code>`;
    if (tagExtra) {
      output += `${properName} ${parseAndEscape(tagExtra)}\n<br>`;
    } else {
      const found = tagLookup ? tagLookup(tagName) : null;
      if (!found) {
        const low = tagName.toLowerCase();
        output += `${escapeForHTML(tagName)}${low === 'none' || low === 'todo' ? '' : ' ERROR: TAG INVALID'}\n<br>`;
      } else {
        let desc = parseAndEscape(found.description);
        if (desc.includes('\n')) {
          desc = desc.slice(0, desc.indexOf('\n')) + ` <a href="/Docs/Tags/${found.cleanedName}">(...)</a>`;
        }
        output += `<a href="/Docs/Tags/${found.cleanedName}">${properName}</a> ${desc}\n<br>`;
      }
    }
  }
  return output;
}
