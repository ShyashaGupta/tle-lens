import * as vscode from 'vscode';
import * as path from 'path';
import { createCppParser, CppParser } from './parser';
import { analyzeSource } from './analyzer';
import { assess, formatN, formatOps, resolveConstraint } from './constraints';

class ComplexityLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  constructor(private readonly parser: CppParser) {}

  refresh(): void {
    this.emitter.fire();
  }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const cfg = vscode.workspace.getConfiguration('bigOLens');
    if (!cfg.get<boolean>('enabled', true)) return [];
    const defaultN = cfg.get<number>('defaultN', 0);
    const budget = cfg.get<number>('opsBudget', 100_000_000);

    let results;
    const text = doc.getText();
    try {
      results = analyzeSource(this.parser, text);
    } catch (err) {
      console.error('Big-O Lens: analysis failed', err);
      return [];
    }
    const lines = text.split(/\r?\n/);

    return results.map((r) => {
      const constraint = resolveConstraint(lines, r.line, defaultN);
      const verdict = constraint ? assess(r.complexity, constraint.n, budget) : null;

      const title = verdict ? `⏱ ${r.label} · ${verdict.text}` : `⏱ ${r.label} · estimated`;
      const notes =
        constraint && verdict
          ? [
              `Constraint: n=${formatN(constraint.n)} (${constraint.source}). ` +
                `Counts basic operations only, ignores constant factors. ` +
                `Budget: ${formatOps(budget)} ops (fits up to the budget, borderline up to 10x, TLE beyond).`,
              ...r.notes,
            ]
          : r.notes;

      return new vscode.CodeLens(new vscode.Range(r.line, 0, r.line, 0), {
        title,
        tooltip: 'Click for details',
        command: 'bigOLens.explain',
        arguments: [r.name, r.label, notes],
      });
    });
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let parser: CppParser;
  try {
    parser = await createCppParser(path.join(context.extensionPath, 'parsers'));
  } catch (err) {
    vscode.window.showErrorMessage(`Big-O Lens could not load its C++ parser: ${String(err)}`);
    return;
  }

  const provider = new ComplexityLensProvider(parser);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'cpp' }, provider),

    vscode.commands.registerCommand('bigOLens.explain', (name: string, label: string, notes: string[]) => {
      const detail = notes.length ? notes.join('\n') : 'No loops, recursion or known library calls found.';
      vscode.window.showInformationMessage(
        `${name}: ${label} (estimated)`,
        { modal: true, detail: `${detail}\n\nThis is a static heuristic and can be wrong on tricky code.` },
      );
    }),

    vscode.commands.registerCommand('bigOLens.toggle', async () => {
      const cfg = vscode.workspace.getConfiguration('bigOLens');
      await cfg.update('enabled', !cfg.get<boolean>('enabled', true), vscode.ConfigurationTarget.Global);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('bigOLens')) provider.refresh();
    }),
  );
}

export function deactivate(): void {}
