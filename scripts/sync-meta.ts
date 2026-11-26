import fs from 'fs';
import path from 'path';
import { loadAllMetaDocs, serializeMetaDocs, DEFAULT_SOURCES } from '../src/lib/meta-loader';
import { buildSuggestionsFromDocs, serializeSuggestions } from '../src/lib/suggestions';
import { buildChangelog, buildMetaIndex, loadPreviousState } from '../src/lib/changelog';

async function main() {
  console.log('Fetching and building Denizen Meta docs...');
  const docs = await loadAllMetaDocs(DEFAULT_SOURCES, true);
  console.log(`Loaded:
  - ${Object.keys(docs.commands).length} Commands
  - ${Object.keys(docs.tags).length} Tags
  - ${Object.keys(docs.events).length} Events
  - ${Object.keys(docs.mechanisms).length} Mechanisms
  - ${Object.keys(docs.actions).length} Actions
  - ${Object.keys(docs.languages).length} Languages
  - ${Object.keys(docs.objectTypes).length} ObjectTypes
  - ${docs.allObjects.length} Total Objects`);

  const outDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // "What's new": diff against the previous sync (live site or local files) before anything is overwritten.
  const prev = await loadPreviousState(outDir);
  const index = buildMetaIndex(docs);
  const { changelog, update } = await buildChangelog(docs, index, prev);
  fs.writeFileSync(path.join(outDir, 'meta-index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(outDir, 'changelog.json'), JSON.stringify(changelog));
  console.log(
    !prev.index
      ? 'Changelog: no previous index found, saved a baseline.'
      : update
      ? `Changelog (vs ${prev.from}): +${update.counts.added} / -${update.counts.removed} / ~${update.counts.changed} entries, ${update.sources.length} source(s) changed.`
      : `Changelog (vs ${prev.from}): no changes.`
  );

  // Build suggestions BEFORE stripping build-only fields
  const suggestions = buildSuggestionsFromDocs(docs);
  const suggestionsStr = serializeSuggestions(suggestions);
  const suggestionsFile = path.join(outDir, 'search-suggestions.json');
  fs.writeFileSync(suggestionsFile, suggestionsStr);
  console.log(`Saved search suggestions to ${suggestionsFile} (${(fs.statSync(suggestionsFile).size / 1024).toFixed(1)} KB)`);

  const jsonStr = serializeMetaDocs(docs);
  const outFile = path.join(outDir, 'denizen-meta.json');
  fs.writeFileSync(outFile, jsonStr);
  console.log(`Saved to ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);

  const cacheDir = path.join(process.cwd(), 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cacheFile = path.join(cacheDir, 'meta-docs.json');
  fs.writeFileSync(cacheFile, jsonStr);
  console.log(`Saved to ${cacheFile} (${(fs.statSync(cacheFile).size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error('Error during sync-meta:', err);
  process.exit(1);
});
