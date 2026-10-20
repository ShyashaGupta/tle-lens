// Copies the WebAssembly parser files into ./parsers so the extension can load them.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'parsers');
fs.mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/tree-sitter-wasms/out/tree-sitter-cpp.wasm', 'tree-sitter-cpp.wasm'],
  ['node_modules/web-tree-sitter/tree-sitter.wasm', 'tree-sitter.wasm'],
];
for (const [src, dst] of files) {
  fs.copyFileSync(path.join(root, src), path.join(out, dst));
  console.log('copied', dst);
}
