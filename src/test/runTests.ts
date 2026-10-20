// Runs the analyzer against test-samples/*.cpp. Each sample starts with:
//   // expect: O(n²)
//   // func: name        (optional; defaults to the first function in the file)
import * as fs from 'fs';
import * as path from 'path';
import { createCppParser } from '../parser';
import { analyzeSource } from '../analyzer';

async function main(): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const parser = await createCppParser(path.join(root, 'parsers'));
  const dir = path.join(root, 'test-samples');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cpp')).sort();

  let passed = 0;
  const failures: string[] = [];

  for (const file of files) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const expected = /^\/\/\s*expect:\s*(.+)$/m.exec(src)?.[1].trim();
    const target = /^\/\/\s*func:\s*(\w+)/m.exec(src)?.[1];
    const results = analyzeSource(parser, src);
    const r = target ? results.find((x) => x.name === target) : results[0];
    const actual = r?.label ?? '(no function found)';

    if (actual === expected) {
      passed++;
      console.log(`  ok   ${file.padEnd(34)} ${actual}`);
    } else {
      failures.push(file);
      console.log(`  FAIL ${file.padEnd(34)} expected ${expected}, got ${actual}`);
    }
  }

  console.log(`\n${passed}/${files.length} samples passed`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
