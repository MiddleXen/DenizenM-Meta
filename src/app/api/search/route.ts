import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { filterSuggestions, SearchSuggestion } from '@/lib/suggestions';

let cachedList: SearchSuggestion[] | null = null;

function loadSuggestions(): SearchSuggestion[] {
  if (cachedList) return cachedList;
  const filePath = path.join(process.cwd(), 'public', 'data', 'search-suggestions.json');
  if (fs.existsSync(filePath)) {
    try {
      cachedList = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return cachedList!;
    } catch (e) {
      console.error('Failed to parse search-suggestions.json:', e);
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const type = req.nextUrl.searchParams.get('type') || undefined;
  const limitStr = req.nextUrl.searchParams.get('limit') || '8';
  const limit = Math.min(20, Math.max(1, parseInt(limitStr, 10)));

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  const list = loadSuggestions();
  const results = filterSuggestions(list, q, limit, type);
  return NextResponse.json(results);
}
