import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';

import { NodeFileSystem } from 'langium/node';
import { URI } from 'langium';
import { createPlanningSpecServices, PlanningSpecMiniZincGenerator } from 'planning-spec-language';

let client: LanguageClient;
let generator: PlanningSpecMiniZincGenerator | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    client = await startLanguageClient(context);

    // Créer un contexte minimal pour les services partagés
    const shared = createPlanningSpecServices({
        fileSystemProvider: NodeFileSystem.fileSystemProvider
    }).shared;

    const servicesList = shared.ServiceRegistry.all;
    const planningSpecServices = servicesList.find(
        s => s.LanguageMetaData.languageId === 'planning-spec'
    );

    if (planningSpecServices && 'generator' in planningSpecServices) {
        const genService = planningSpecServices.generator as any;
        if (genService && 'Generator' in genService) {
            generator = genService.Generator as PlanningSpecMiniZincGenerator;
        }
    }

    const disposable1 = vscode.commands.registerCommand(
        'planning-spec.generateMiniZinc',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !generator) {
                return;
            }

            const uri = editor.document.uri;
            const fsPath = uri.fsPath;

            // Convertir string → URI
            const documentUri = URI.file(fsPath);

            const document = await shared.workspace.LangiumDocumentFactory.fromString(
                await vscode.workspace.fs.readFile(uri).then(b => b.toString()),
                documentUri
            );

            const outPath = generator.generateToFile(document, 'out');

            const mznUri = vscode.Uri.file(outPath);
            const terminal = vscode.window.createTerminal('MiniZinc');
            terminal.show();

            // Lancer minizinc sur le fichier généré
            terminal.sendText(`minizinc "${outPath}"`, true);
            await vscode.window.showTextDocument(mznUri);
        }
    );

    const disposable2 = vscode.commands.registerCommand(
        'planning-spec.run',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !generator) {
                return;
            }

            const uri = editor.document.uri;
            const fsPath = uri.fsPath;

            const documentUri = URI.file(fsPath);
            const document = await shared.workspace.LangiumDocumentFactory.fromString(
                await vscode.workspace.fs.readFile(uri).then(b => b.toString()),
                documentUri
            );

            const outPath = generator.generateToFile(document, 'out');

            // Créer / réutiliser un terminal
            const terminal = vscode.window.createTerminal('MiniZinc');
            terminal.show();

            // Lancer minizinc sur le fichier généré
            terminal.sendText(`minizinc --solver Highs "${outPath}"`, true);
        }
    );

    context.subscriptions.push(disposable1, disposable2);
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    const debugOptions = {
        execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`]
    };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: '*', language: 'planning-spec' }]
    };

    const client = new LanguageClient(
        'planning-spec',
        'PlanningSpec',
        serverOptions,
        clientOptions
    );

    await client.start();
    return client;
}
