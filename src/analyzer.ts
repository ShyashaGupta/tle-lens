/**
 * Heuristic time-complexity estimator for C++ functions.
 * Works on a tree-sitter syntax tree. It does NOT import 'vscode', so it can be unit-tested in plain Node.
 *
 * Complexity is modelled as n^a * (log n)^b, plus "exponential" and "unknown".
 */
import Parser = require('web-tree-sitter');

type Node = Parser.SyntaxNode;

export type Complexity =
  | { kind: 'poly'; n: number; log: number }
  | { kind: 'exp' }
  | { kind: 'unknown' };

export interface FunctionResult {
  name: string;
  /** 0-based line where the function starts */
  line: number;
  label: string;
  notes: string[];
}

interface Ctx {
  notes: string[];
}

// ---------- complexity algebra ----------

const poly = (n: number, log = 0): Complexity => ({ kind: 'poly', n, log });
const ONE = poly(0);
const N = poly(1);
const LOGN = poly(0, 1);
const SQRTN = poly(0.5);
const EXP: Complexity = { kind: 'exp' };
const UNKNOWN: Complexity = { kind: 'unknown' };

const isConst = (c: Complexity): boolean => c.kind === 'poly' && c.n === 0 && c.log === 0;

function max(a: Complexity, b: Complexity): Complexity {
  if (a.kind === 'unknown' || b.kind === 'unknown') return UNKNOWN;
  if (a.kind === 'exp' || b.kind === 'exp') return EXP;
  if (a.n !== b.n) return a.n > b.n ? a : b;
  return a.log >= b.log ? a : b;
}

function mul(a: Complexity, b: Complexity): Complexity {
  if (a.kind === 'unknown' || b.kind === 'unknown') return UNKNOWN;
  if (a.kind === 'exp' || b.kind === 'exp') return EXP;
  return poly(a.n + b.n, a.log + b.log);
}

export function format(c: Complexity): string {
  if (c.kind === 'exp') return 'O(2ⁿ)';
  if (c.kind === 'unknown') return 'O(?)';
  if (c.n === 0 && c.log === 0) return 'O(1)';
  const parts: string[] = [];
  if (c.n !== 0) {
    parts.push(c.n === 0.5 ? '√n' : c.n === 1 ? 'n' : c.n === 2 ? 'n²' : c.n === 3 ? 'n³' : `n^${c.n}`);
  }
  if (c.log !== 0) parts.push(c.log === 1 ? 'log n' : `log^${c.log} n`);
  return `O(${parts.join(' ')})`;
}

// ---------- known library calls ----------

const LIB = new Map<string, Complexity>([
  ['sort', poly(1, 1)],
  ['stable_sort', poly(1, 1)],
  ['nth_element', N],
  ['reverse', N],
  ['find', N],
  ['find_if', N],
  ['count', N],
  ['count_if', N],
  ['accumulate', N],
  ['max_element', N],
  ['min_element', N],
  ['fill', N],
  ['copy', N],
  ['unique', N],
  ['iota', N],
  ['next_permutation', N],
  ['binary_search', LOGN],
  ['lower_bound', LOGN],
  ['upper_bound', LOGN],
  ['equal_range', LOGN],
  ['memset', N],
  ['strlen', N],
]);
// These do not take iterator ranges, so we skip the "looks like an STL call" check.
const NO_RANGE_CHECK = new Set(['memset', 'strlen']);

const LOOP_TYPES = new Set(['for_statement', 'while_statement', 'do_statement', 'for_range_loop']);

function libraryCost(call: Node, ctx: Ctx): Complexity {
  const fnNode = call.childForFieldName('function');
  if (!fnNode || (fnNode.type !== 'identifier' && fnNode.type !== 'qualified_identifier')) return ONE;
  const raw = fnNode.text;
  const name = raw.replace(/^std::(ranges::)?/, '');
  const known = LIB.get(name);
  if (!known) return ONE;

  // Guard against user-defined functions that share a name (e.g. a DSU `find(x)`):
  // only count it if it is std::-qualified or its arguments look like an iterator range.
  const args = call.childForFieldName('arguments')?.text ?? '';
  const looksStl =
    raw.startsWith('std::') ||
    NO_RANGE_CHECK.has(name) ||
    /begin\s*\(|end\s*\(|\w+\s*,\s*\w+\s*\+/.test(args);
  if (!looksStl) return ONE;

  ctx.notes.push(`Line ${call.startPosition.row + 1}: ${raw}() is ${format(known)}`);
  return known;
}

// ---------- loops ----------

function loopIterations(node: Node): { iterations: Complexity; why: string } {
  if (node.type === 'for_range_loop') {
    return { iterations: N, why: 'range-based for loop → linear' };
  }

  const body = node.childForFieldName('body');
  const bodyText = body?.text ?? '';
  let init = '';
  let cond = '';
  let update = '';

  if (node.type === 'do_statement') {
    cond = node.childForFieldName('condition')?.text ?? '';
  } else {
    const header = node.text.slice(0, body ? body.startIndex - node.startIndex : node.text.length);
    const open = header.indexOf('(');
    const close = header.lastIndexOf(')');
    const inner = open >= 0 && close > open ? header.slice(open + 1, close) : '';
    if (node.type === 'for_statement') {
      const parts = inner.split(';').map((s) => s.trim());
      init = parts[0] ?? '';
      cond = parts[1] ?? '';
      update = parts[2] ?? '';
    } else {
      cond = inner.trim();
    }
  }

  const isFor = node.type === 'for_statement';

  // 1. Constant bound: for (int i = 0; i < 5; i++)
  if (
    isFor &&
    /=\s*-?\d+\s*$/.test(init) &&
    /^\s*\w+\s*(<=|<|>=|>)\s*-?\d+\s*$/.test(cond)
  ) {
    return { iterations: ONE, why: 'loop with constant bounds → O(1)' };
  }

  // 2. Variable is multiplied/divided each step → logarithmic
  const stepper = isFor ? update : bodyText;
  const shrinks =
    /(\*=|\/=|<<=|>>=)/.test(stepper) || /(\b\w+)\s*=\s*\1\s*[*\/]\s*\w+/.test(stepper);
  if (shrinks) {
    return { iterations: LOGN, why: 'loop variable is multiplied/divided each step → log n' };
  }

  // 3. Binary-search style: lo = mid + 1 / hi = mid - 1
  if (!isFor && /\b\w+\s*=\s*(mid|m|middle)\b\s*[+\-;]/.test(bodyText)) {
    return { iterations: LOGN, why: 'binary-search style loop (moves bounds to mid) → log n' };
  }

  // 4. i * i <= n  or  i <= sqrt(n)
  if (/(\w+)\s*\*\s*\1\s*<=?\s*\w+/.test(cond) || /sqrt\s*\(/.test(cond)) {
    return { iterations: SQRTN, why: 'loop runs while i*i <= n → √n' };
  }

  return { iterations: N, why: 'loop → linear (assumes bound depends on input size)' };
}

// ---------- cost of a syntax node ----------

function cost(node: Node, ctx: Ctx): Complexity {
  // Lambdas and nested function definitions are not executed by merely being declared.
  if (node.type === 'lambda_expression' || node.type === 'function_definition') return ONE;

  if (LOOP_TYPES.has(node.type)) {
    const { iterations, why } = loopIterations(node);
    ctx.notes.push(`Line ${node.startPosition.row + 1}: ${why}`);
    const body = node.childForFieldName('body');
    return mul(iterations, body ? cost(body, ctx) : ONE);
  }

  let result = ONE;
  if (node.type === 'call_expression') result = max(result, libraryCost(node, ctx));
  for (const child of node.namedChildren) result = max(result, cost(child, ctx));
  return result;
}

// ---------- recursion ----------

function isSelfCall(call: Node, name: string): boolean {
  const fn = call.childForFieldName('function');
  if (!fn) return false;
  const last = fn.text.replace(/<.*>$/, '').split(/::|\.|->/).pop() ?? '';
  return last.trim() === name;
}

function collectSelfCalls(
  node: Node,
  name: string,
  inLoop: boolean,
  out: { node: Node; inLoop: boolean }[],
): void {
  if (node.type === 'lambda_expression') return;
  const nowInLoop = inLoop || LOOP_TYPES.has(node.type);
  if (node.type === 'call_expression' && isSelfCall(node, name)) out.push({ node, inLoop });
  for (const child of node.namedChildren) collectSelfCalls(child, name, nowInLoop, out);
}

function endsWithReturn(node: Node | null): boolean {
  if (!node) return false;
  if (node.type === 'return_statement') return true;
  if (node.type === 'compound_statement') {
    const last = node.namedChildren[node.namedChildren.length - 1];
    return endsWithReturn(last ?? null);
  }
  return false;
}

/**
 * Worst-case number of self-calls along ONE execution path.
 * if/else branches count the larger branch; an `if (...) return ...;` exits early,
 * so its calls are not added to the fall-through path.
 */
function pathCalls(node: Node, name: string): number {
  if (node.type === 'lambda_expression') return 0;

  if (node.type === 'if_statement' || node.type === 'conditional_expression') {
    const cond = node.childForFieldName('condition');
    const cons = node.childForFieldName('consequence');
    const alt = node.childForFieldName('alternative');
    return (
      (cond ? pathCalls(cond, name) : 0) +
      Math.max(cons ? pathCalls(cons, name) : 0, alt ? pathCalls(alt, name) : 0)
    );
  }

  if (node.type === 'compound_statement') {
    let running = 0;
    let best = 0;
    for (const child of node.namedChildren) {
      const c = pathCalls(child, name);
      if (
        child.type === 'if_statement' &&
        !child.childForFieldName('alternative') &&
        endsWithReturn(child.childForFieldName('consequence'))
      ) {
        best = Math.max(best, running + c); // path that exits here
        const cond = child.childForFieldName('condition');
        running += cond ? pathCalls(cond, name) : 0; // fall-through path skips the branch
      } else {
        running += c;
      }
    }
    return Math.max(best, running);
  }

  let n = node.type === 'call_expression' && isSelfCall(node, name) ? 1 : 0;
  for (const child of node.namedChildren) n += pathCalls(child, name);
  return n;
}

function splitsRange(args: string): boolean {
  // e.g. quickSort(a, lo, p - 1) and quickSort(a, p + 1, hi)
  const re = /(\w+)\s*-\s*1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(args)) !== null) {
    if (new RegExp(`\\b${m[1]}\\s*\\+\\s*1`).test(args)) return true;
  }
  return false;
}

// ---------- function-level analysis ----------

function functionName(fn: Node): string {
  const decl = fn.childForFieldName('declarator');
  if (!decl) return '';
  const fd = decl.type === 'function_declarator' ? decl : decl.descendantsOfType('function_declarator')[0];
  const id = fd?.childForFieldName('declarator');
  if (!id) return '';
  return id.text.split('::').pop()!.replace(/<.*>$/, '').trim();
}

export function analyzeFunction(fn: Node): FunctionResult | null {
  const body = fn.childForFieldName('body');
  if (!body) return null;

  const name = functionName(fn);
  const ctx: Ctx = { notes: [] };
  const base = cost(body, ctx);
  let result = base;

  const calls: { node: Node; inLoop: boolean }[] = [];
  if (name) collectSelfCalls(body, name, false, calls);

  if (calls.length > 0) {
    const k = Math.max(1, pathCalls(body, name));
    const args = calls.map((c) => c.node.childForFieldName('arguments')?.text ?? '').join(' ');
    const rangeSplit = splitsRange(args);
    const divides = /\/\s*\w|>>\s*\w|\bmid\b/.test(args) || rangeSplit;
    const inLoop = calls.some((c) => c.inLoop);
    const memo = /\b(memo|dp|cache|visited|seen)\b/i.test(body.text);

    ctx.notes.push(
      `Recursive: ${k} call(s) per path, ${divides ? 'input is split' : 'input shrinks by a constant'}`,
    );

    if (base.kind !== 'poly') {
      result = base;
    } else if (inLoop && !divides) {
      result = EXP;
      ctx.notes.push('Recursive call inside a loop: branching grows exponentially (possibly worse, e.g. n!)');
    } else if (k === 1) {
      result = divides ? (isConst(base) ? LOGN : base) : mul(base, N);
    } else if (!divides) {
      result = EXP;
    } else if (k === 2) {
      result = base.n === 0 ? N : base.n === 1 ? poly(1, base.log + 1) : base;
    } else {
      result = UNKNOWN;
      ctx.notes.push('3+ recursive calls on split input: cannot estimate');
    }

    if (rangeSplit && k === 2) {
      ctx.notes.push('Assumes balanced splits (average case). Worst case may be higher (e.g. quicksort O(n²)).');
    }
    if (memo && result.kind === 'exp') {
      result = UNKNOWN;
      ctx.notes.push('Looks memoized (memo/dp/cache): complexity depends on number of states, not estimated');
    }
  }

  return {
    name: name || '(anonymous)',
    line: fn.startPosition.row,
    label: format(result),
    notes: ctx.notes,
  };
}

export function analyzeSource(parser: Parser, source: string): FunctionResult[] {
  const tree = parser.parse(source);
  const out: FunctionResult[] = [];
  for (const fn of tree.rootNode.descendantsOfType('function_definition')) {
    const r = analyzeFunction(fn);
    if (r) out.push(r);
  }
  tree.delete(); // free WebAssembly memory
  return out;
}
