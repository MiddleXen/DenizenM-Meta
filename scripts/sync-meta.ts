import fs from 'fs';
import path from 'path';
import { loadAllMetaDocs, DEFAULT_SOURCES } from '../src/lib/meta-loader';

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
  const outFile = path.join(outDir, 'denizen-meta.json');
  const jsonStr = JSON.stringify(docs);
  fs.writeFileSync(outFile, jsonStr);
  console.log(`Saved to ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);

  const cacheDir = path.join(process.cwd(), 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cacheFile = path.join(cacheDir, 'meta-docs.json');
  fs.writeFileSync(cacheFile, jsonStr);
  console.log(`Saved to ${cacheFile} (${(fs.statSync(cacheFile).size / 1024 / 1024).toFixed(2)} MB)`);

  const { buildSuggestionsFromDocs } = await import('../src/lib/suggestions');
  const suggestions = buildSuggestionsFromDocs(docs);
  const suggestionsFile = path.join(outDir, 'search-suggestions.json');
  fs.writeFileSync(suggestionsFile, JSON.stringify(suggestions));
  console.log(`Saved search suggestions to ${suggestionsFile} (${(fs.statSync(suggestionsFile).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('Error during sync-meta:', err);
  process.exit(1);
});
