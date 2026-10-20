import Parser = require('web-tree-sitter');
import * as path from 'path';

export type CppParser = Parser;

/** Loads the WebAssembly C++ parser from the given folder (contains the two .wasm files). */
export async function createCppParser(wasmDir: string): Promise<CppParser> {
  await Parser.init({
    locateFile: () => path.join(wasmDir, 'tree-sitter.wasm'),
  });
  const parser = new Parser();
  const cpp = await Parser.Language.load(path.join(wasmDir, 'tree-sitter-cpp.wasm'));
  parser.setLanguage(cpp);
  return parser;
}
