
# TLE Lens


[![Version](https://img.shields.io/visual-studio-marketplace/v/shyashagupta.tle-lens)](https://marketplace.visualstudio.com/items?itemName=shyashagupta.tle-lens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/shyashagupta.tle-lens)](https://marketplace.visualstudio.com/items?itemName=shyashagupta.tle-lens)
[![License](https://img.shields.io/github/license/ShyashaGupta/tle-lens)](https://github.com/ShyashaGupta/tle-lens/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/ShyashaGupta/tle-lens)](https://github.com/ShyashaGupta/tle-lens/issues)


A Visual Studio Code extension for inline time complexity estimation of C++ functions.

**Install:** Search for `TLE Lens` in VS Code Extensions or [install it from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=shyashagupta.tle-lens).

## Overview

See an **estimated time complexity** above every C++ function, right in VS Code.

```cpp
// Example: O(n²) estimated
int countPairs(vector<int>& a) {
    // Your implementation
}
```

Click the CodeLens to see *why* the complexity was estimated, including loops, recursion, and library calls.

<!-- Add a demo GIF here when available -->
<!-- ![TLE Lens Demo](images/demo.gif) -->

## What it detects

| Pattern | Result |
|---|---|
| No loops | O(1) |
| Single and nested loops | O(n), O(n²), O(n³), ... |
| `i *= 2`, `n /= 10`, binary-search-style `lo = mid + 1` | O(log n) |
| `i * i <= n` | O(√n) |
| Loops with constant bounds (`i < 5`) | O(1) |
| `std::sort`, `stable_sort` | O(n log n) |
| `std::find`, `count`, `accumulate`, `reverse`, etc. | O(n) |
| `lower_bound`, `upper_bound`, `binary_search` | O(log n) |
| Recursion: linear, halving, merge/quick sort shape, branching | O(n), O(log n), O(n log n), O(2ⁿ) |

## Limitations

TLE Lens uses static analysis heuristics. Its estimates are not mathematical proofs.

- Loop bounds are assumed to depend on input size `n`, unless they are literal constants.
- Calls to other functions are not followed (no whole-program analysis).
- Member calls like `map.find()` or `set.insert()` are not costed.
- Amortized patterns (two pointers, monotonic stack) may be overestimated.
- Recursion with memoization is reported as `O(?)`.
- Quicksort-shaped recursion assumes balanced splits (average case).
- C++ only for now.

## Tech Stack

- **Language:** TypeScript
- **Parsing:** Tree-sitter C++ and WebAssembly
- **Editor Integration:** VS Code Extension API and CodeLens
- **Testing:** Automated analyzer test suite

## Develop

```bash
npm install
npm run compile
npm test
```

Press **F5** in VS Code to launch an Extension Development Host and open any `.cpp` file.

Add a test by placing a `.cpp` file in `test-samples/` starting with:

```cpp
// expect: O(...)
```

## How it works

1. `web-tree-sitter` (WebAssembly) parses the file into a syntax tree. It tolerates half-typed code.
2. `src/analyzer.ts` walks each function: loops multiply the cost of their body, sequential code takes the maximum, and self-calls are classified by recursion structure.
3. `src/extension.ts` renders results as CodeLens and shows the explanation on click.

## Publish

```bash
npm install -g @vscode/vsce
vsce package
vsce publish
```

The generated VSIX package can be installed through **Extensions → ... → Install from VSIX**.

Manage your publisher at:
https://marketplace.visualstudio.com/manage

## Roadmap

- Python and Java support
- Follow calls between your own functions
- Space complexity estimation
- Optional AI-powered explanations

## Links

- [GitHub Repository](https://github.com/ShyashaGupta/tle-lens)
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=shyashagupta.tle-lens)

## Contributing

Contributions, bug reports, and feature suggestions are welcome! Feel free to open an issue or submit a pull request.
