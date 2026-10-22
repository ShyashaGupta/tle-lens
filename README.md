# TLE Lens

See an **estimated time complexity** above every C++ function, right in VS Code.

```
⏱ O(n²) · estimated
int countPairs(vector<int>& a) { ... }
```

Click the lens to see *why* (which loops, which recursion, which library calls).

> Add a demo GIF here: `![demo](images/demo.gif)`

## What it detects

| Pattern | Result |
|---|---|
| No loops | O(1) |
| Single loop, nested loops | O(n), O(n²), O(n³) … |
| `i *= 2`, `n /= 10`, binary-search style `lo = mid + 1` | O(log n) |
| `i * i <= n` | O(√n) |
| Loops with constant bounds (`i < 5`) | O(1) |
| `std::sort`, `stable_sort` | O(n log n) |
| `std::find`, `count`, `accumulate`, `reverse`… | O(n) |
| `lower_bound`, `upper_bound`, `binary_search` | O(log n) |
| Recursion: linear, halving, merge/quick sort shape, branching | O(n), O(log n), O(n log n), O(2ⁿ) |

## Limitations (it is a heuristic, not a proof)

- Loop bounds are assumed to depend on input size `n`, unless they are literal constants.
- Calls to your **other** functions are not followed (no whole-program analysis).
- Member calls like `map.find()` or `set.insert()` are not costed.
- Amortized patterns (two pointers, monotonic stack) may be over-estimated.
- Recursion with memoization is reported as `O(?)`.
- Quicksort-shaped recursion assumes balanced splits (average case).
- C++ only for now.

## Develop

```bash
npm install     # also copies the .wasm parser files into ./parsers
npm test        # compiles and checks the analyzer against test-samples/
```
Then press **F5** in VS Code to launch an Extension Development Host and open any `.cpp` file.

Add a test: drop a `.cpp` file into `test-samples/` starting with `// expect: O(...)`.

## How it works

1. `web-tree-sitter` (WebAssembly) parses the file into a syntax tree. It tolerates half-typed code.
2. `src/analyzer.ts` walks each function: loops multiply the cost of their body, sequential code takes the max, and self-calls are classified (how many per path, and whether the input is split or shrinks).
3. `src/extension.ts` renders results as CodeLens and shows the explanation on click.

## Publish

```bash
npm install -g @vscode/vsce
vsce login <your-publisher-id>
vsce package      # creates big-o-lens-0.1.0.vsix  (test it: Extensions → ... → Install from VSIX)
vsce publish
```
Create the publisher ID at https://marketplace.visualstudio.com/manage (needs a Microsoft account / Azure DevOps token).
Replace `publisher`, `repository` and the LICENSE name first.

## Roadmap

- Python and Java support
- Follow calls between your own functions
- Space complexity estimate
- Optional "explain this" using an LLM
