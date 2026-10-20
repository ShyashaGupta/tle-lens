import * as vscode from 'vscode';
import * as path from 'path';
import { createCppParser, CppParser } from './parser';
import { analyzeSource } from './analyzer';

class ComplexityLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  constructor(private readonly parser: CppParser) {}

  refresh(): void {
    this.emitter.fire();
  }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const enabled = vscode.workspace.getConfiguration('bigOLens').get<boolean>('enabled', true);
    if (!enabled) return [];

    let results;
    try {
      results = analyzeSource(this.parser, doc.getText());
    } catch (err) {
      console.error('Big-O Lens: analysis failed', err);
      return [];
    }

    return results.map(
      (r) =>
        new vscode.CodeLens(new vscode.Range(r.line, 0, r.line, 0), {
          title: `⏱ ${r.label} · estimated`,
          tooltip: 'Click for details',
          command: 'bigOLens.explain',
          arguments: [r.name, r.label, r.notes],
        }),
    );
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
