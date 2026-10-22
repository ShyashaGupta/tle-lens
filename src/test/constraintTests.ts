// Unit tests for the constraint logic. They do not need the parser.
import * as assert from 'assert';
import type { Complexity } from '../analyzer';
import {
  assess,
  classify,
  findConstraintAbove,
  findFileConstraint,
  formatN,
  formatOps,
  operations,
  parseNumber,
  resolveConstraint,
} from '../constraints';

const poly = (n: number, log = 0): Complexity => ({ kind: 'poly', n, log });
const EXP: Complexity = { kind: 'exp' };
const UNKNOWN: Complexity = { kind: 'unknown' };

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}

test('parseNumber: scientific notation', () => {
  assert.strictEqual(parseNumber('2e5'), 200000);
  assert.strictEqual(parseNumber('1e5'), 100000);
  assert.strictEqual(parseNumber('1.5e5'), 150000);
  assert.strictEqual(parseNumber('1e9+7'), 1e9);
});
test('parseNumber: plain, underscores, powers, shifts', () => {
  assert.strictEqual(parseNumber('200000'), 200000);
  assert.strictEqual(parseNumber('200_000'), 200000);
  assert.strictEqual(parseNumber('2*10^5'), 200000);
  assert.strictEqual(parseNumber('2 × 10^5'), 200000);
  assert.strictEqual(parseNumber('10^5'), 100000);
  assert.strictEqual(parseNumber('2^17'), 131072);
  assert.strictEqual(parseNumber('1<<17'), 131072);
});
test('parseNumber: garbage', () => {
  assert.strictEqual(parseNumber('abc'), undefined);
  assert.strictEqual(parseNumber(''), undefined);
});

test('findConstraintAbove: comment directly above', () => {
  const lines = ['// n <= 2e5', 'int f() {', '}'];
  assert.strictEqual(findConstraintAbove(lines, 1)?.n, 200000);
});
test('findConstraintAbove: unicode, range and block-comment forms', () => {
  assert.strictEqual(findConstraintAbove(['// n ≤ 10^5', 'int f(){}'], 1)?.n, 100000);
  assert.strictEqual(findConstraintAbove(['// 1 <= n <= 1e5', 'int f(){}'], 1)?.n, 100000);
  assert.strictEqual(findConstraintAbove(['/* n <= 1e5 */', 'int f(){}'], 1)?.n, 100000);
  assert.strictEqual(findConstraintAbove(['/*', ' * n <= 1e4', ' */', 'int f(){}'], 3)?.n, 10000);
});
test('findConstraintAbove: skips template line and blank lines', () => {
  const lines = ['// n <= 5e4', '', 'template <class T>', 'int f(T x) {}'];
  assert.strictEqual(findConstraintAbove(lines, 3)?.n, 50000);
});
test('findConstraintAbove: trailing comment on the function line', () => {
  assert.strictEqual(findConstraintAbove(['int f() { // n <= 1e3'], 0)?.n, 1000);
});
test('findConstraintAbove: stops at real code', () => {
  const lines = ['// n <= 5', 'int x = 0;', 'int f() {}'];
  assert.strictEqual(findConstraintAbove(lines, 2), undefined);
});

test('findFileConstraint: header comment', () => {
  const lines = ['#include <bits/stdc++.h>', '// n <= 2e5', 'using namespace std;', 'int f() {}'];
  assert.strictEqual(findFileConstraint(lines)?.n, 200000);
});
test('findFileConstraint: ignores comments after code starts', () => {
  const lines = ['int g() {}', '// n <= 5', 'int f() {}'];
  assert.strictEqual(findFileConstraint(lines), undefined);
});
test('findFileConstraint: const N / #define N / constexpr MAXN', () => {
  assert.strictEqual(findFileConstraint(['const int N = 2e5 + 5;'])?.n, 200000);
  assert.strictEqual(findFileConstraint(['#define N 200005'])?.n, 200005);
  assert.strictEqual(findFileConstraint(['constexpr int MAXN = 1e5;'])?.n, 100000);
  assert.strictEqual(findFileConstraint(['const long long MOD = 1e9+7;']), undefined);
});

test('resolveConstraint: priority and fallback', () => {
  const lines = ['// n <= 100', 'int a() {}', '', 'int b() {}'];
  assert.strictEqual(resolveConstraint(lines, 1, 5000)?.n, 100); // function comment
  assert.strictEqual(resolveConstraint(['int b() {}'], 0, 5000)?.n, 5000); // setting
  assert.strictEqual(resolveConstraint(['int b() {}'], 0, 0), undefined); // nothing
});

test('operations: polynomial, log and constant', () => {
  assert.strictEqual(operations(poly(2), 1e5), 1e10);
  assert.strictEqual(operations(poly(0), 1e9), 1);
  const nlogn = operations(poly(1, 1), 2e5) as number;
  assert.ok(nlogn > 3.4e6 && nlogn < 3.7e6, `got ${nlogn}`);
});
test('operations: exponential and unknown', () => {
  assert.strictEqual(operations(EXP, 10), 1024);
  assert.strictEqual(operations(EXP, 5000), Infinity);
  assert.strictEqual(operations(UNKNOWN, 10), null);
});

test('classify: thresholds', () => {
  assert.strictEqual(classify(1e8, 1e8), 'ok');
  assert.strictEqual(classify(9e8, 1e8), 'borderline');
  assert.strictEqual(classify(1e9, 1e8), 'borderline');
  assert.strictEqual(classify(1.1e9, 1e8), 'tle');
});

test('formatOps / formatN', () => {
  assert.strictEqual(formatOps(4e10), '4×10¹⁰');
  assert.strictEqual(formatOps(3.52e6), '3.5×10⁶');
  assert.strictEqual(formatOps(500), '500');
  assert.strictEqual(formatOps(999999), '1×10⁶');
  assert.strictEqual(formatOps(Infinity), 'astronomical');
  assert.strictEqual(formatN(200000), '2e5');
  assert.strictEqual(formatN(1000), '1e3');
  assert.strictEqual(formatN(1234), '1234');
  assert.strictEqual(formatN(50), '50');
});

test('assess: the headline cases', () => {
  const a = assess(poly(2), 2e5, 1e8)!;
  assert.strictEqual(a.level, 'tle');
  assert.ok(a.text.includes('n=2e5') && a.text.includes('4×10¹⁰') && a.text.includes('likely TLE'), a.text);

  const b = assess(poly(1, 1), 2e5, 1e8)!;
  assert.strictEqual(b.level, 'ok');

  const c = assess(poly(2), 3e4, 1e8)!;
  assert.strictEqual(c.level, 'borderline');

  assert.strictEqual(assess(UNKNOWN, 1e5, 1e8), null);
  assert.strictEqual(assess(EXP, 1e5, 1e8)!.level, 'tle');
});

console.log(`\n${passed}/${passed + failed} constraint tests passed`);
process.exitCode = failed ? 1 : 0;
