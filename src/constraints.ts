/**
 * Constraint-aware "will this TLE?" logic.
 * Pure functions only: no 'vscode' and no parser, so they are easy to unit-test.
 */
import type { Complexity } from './analyzer';

export interface Constraint {
  n: number;
  /** where the value came from, shown in the explanation popup */
  source: string;
}

export type Level = 'ok' | 'borderline' | 'tle';

// ---------- parsing numbers like 2e5, 2*10^5, 10^5, 1<<17, 200_000 ----------

/** Parses the number at the START of `text`. Returns undefined if there is none. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim();
  let m: RegExpExecArray | null;
  let v: number;

  if ((m = /^(\d+(?:\.\d+)?)\s*[*×·x]\s*10\s*\^\s*(\d+)/.exec(t))) v = Number(`${m[1]}e${m[2]}`);
  else if ((m = /^10\s*\^\s*(\d+)/.exec(t))) v = Number(`1e${m[1]}`);
  else if ((m = /^(\d+)\s*\^\s*(\d+)/.exec(t))) v = Math.pow(Number(m[1]), Number(m[2]));
  else if ((m = /^1\s*<<\s*(\d+)/.exec(t))) v = Math.pow(2, Number(m[1]));
  else if ((m = /^(\d+(?:\.\d+)?)[eE](\d+)/.exec(t))) v = Number(`${m[1]}e${m[2]}`);
  else if ((m = /^(\d[\d_]*)/.exec(t))) v = Number(m[1].replace(/_/g, ''));
  else return undefined;

  return Number.isFinite(v) ? v : undefined;
}

// ---------- finding the constraint in the source ----------

const COMPARATOR = /\b[nN]\s*(?:<=|≤|<|=)\s*/;
const CONST_DEF =
  /^\s*(?:(?:static\s+)?const(?:expr)?\s+(?:[\w:]+\s+)+|#define\s+)(MAXN|MAX_N|N)\b\s*=?\s*([^;]*)/;

function isCommentLine(t: string): boolean {
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.endsWith('*/');
}

function commentText(line: string): string | undefined {
  const i = line.indexOf('//');
  if (i >= 0) return line.slice(i + 2);
  const j = line.indexOf('/*');
  if (j >= 0) return line.slice(j + 2);
  const t = line.trim();
  if (t.startsWith('*')) return t.slice(1);
  return undefined;
}

function constraintInComment(line: string): number | undefined {
  const text = commentText(line);
  if (text === undefined) return undefined;
  const m = COMPARATOR.exec(text);
  if (!m) return undefined;
  const v = parseNumber(text.slice(m.index + m[0].length));
  return v !== undefined && v > 0 ? v : undefined;
}

/** Looks for `// n <= 2e5` on the function's own line or in the comments directly above it. */
export function findConstraintAbove(lines: string[], row: number): Constraint | undefined {
  const own = constraintInComment(lines[row] ?? '');
  if (own !== undefined) return { n: own, source: 'comment on the function line' };

  let r = row - 1;
  for (let scanned = 0; r >= 0 && scanned < 8; scanned++, r--) {
    const t = (lines[r] ?? '').trim();
    if (t === '' || /^template\b/.test(t)) continue;
    if (!isCommentLine(t)) break;
    const v = constraintInComment(t);
    if (v !== undefined) return { n: v, source: 'comment above the function' };
  }
  return undefined;
}

/** A constraint that applies to the whole file: a comment in the header area, or `const int N = 2e5 + 5;`. */
export function findFileConstraint(lines: string[]): Constraint | undefined {
  // header area = blank lines, comments, #include/#define, using, typedef (stops at first real code)
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const t = lines[i].trim();
    if (t === '' || /^(#|using\b|typedef\b)/.test(t)) continue;
    if (!isCommentLine(t)) break;
    const v = constraintInComment(t);
    if (v !== undefined) return { n: v, source: 'comment at the top of the file' };
  }
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const m = CONST_DEF.exec(lines[i]);
    if (!m) continue;
    const v = parseNumber(m[2].replace(/^[\s(]+/, ''));
    if (v !== undefined && v > 0) return { n: v, source: `constant ${m[1]}` };
  }
  return undefined;
}

/** Priority: function comment, then file-level comment/constant, then the user setting. */
export function resolveConstraint(
  lines: string[],
  row: number,
  defaultN: number,
): Constraint | undefined {
  return (
    findConstraintAbove(lines, row) ??
    findFileConstraint(lines) ??
    (defaultN > 0 ? { n: defaultN, source: 'setting bigOLens.defaultN' } : undefined)
  );
}

// ---------- operation counts and verdicts ----------

/** Rough number of basic operations for input size n. Constant factors are ignored. */
export function operations(c: Complexity, n: number): number | null {
  if (c.kind === 'unknown') return null;
  if (c.kind === 'exp') return n > 1000 ? Infinity : Math.pow(2, n);
  const lg = n >= 2 ? Math.log2(n) : 1;
  return Math.pow(n, c.n) * (c.log === 0 ? 1 : Math.pow(Math.max(lg, 1), c.log));
}

/** ok: within budget. borderline: up to 10x over budget. tle: more than that. */
export function classify(ops: number, budget: number): Level {
  if (ops <= budget) return 'ok';
  if (ops <= budget * 10) return 'borderline';
  return 'tle';
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number): string =>
  String(n)
    .split('')
    .map((d) => SUP[Number(d)])
    .join('');

export function formatOps(x: number): string {
  if (!Number.isFinite(x)) return 'astronomical';
  if (x < 1000) return String(Math.round(x));
  let e = Math.floor(Math.log10(x));
  let m = Math.round((x / Math.pow(10, e)) * 10) / 10;
  if (m >= 10) {
    m = 1;
    e += 1;
  }
  return `${m}×10${sup(e)}`;
}

export function formatN(n: number): string {
  if (n < 1000) return String(n);
  const e = Math.floor(Math.log10(n));
  const m = n / Math.pow(10, e);
  return Number.isInteger(m) ? `${m}e${e}` : String(n);
}

const VERDICT_TEXT: Record<Level, string> = {
  ok: '✓ fits',
  borderline: '⚠ borderline',
  tle: '✗ likely TLE',
};

/** Text for the CodeLens, e.g. "n=2e5 → ~4×10¹⁰ ops (est.) · ✗ likely TLE". Null if complexity is unknown. */
export function assess(
  c: Complexity,
  n: number,
  budget: number,
): { text: string; level: Level } | null {
  const ops = operations(c, n);
  if (ops === null) return null;
  const level = classify(ops, budget);
  const amount = Number.isFinite(ops) ? `~${formatOps(ops)} ops (est.)` : 'astronomical ops';
  return { text: `n=${formatN(n)} → ${amount} · ${VERDICT_TEXT[level]}`, level };
}
