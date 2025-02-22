import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/browser';
import { activate as commonActivate, deactivate as commonDeactivate, processHtml, processMd } from './common';
import { middleware } from './middleware';

export function activate(context: vscode.ExtensionContext) {
	return commonActivate(context, async (
		id,
		name,
		langs,
		initOptions,
		fillInitializeParams,
	) => {

		class _LanguageClient extends lsp.LanguageClient {
			fillInitializeParams(params: lsp.InitializeParams) {
				fillInitializeParams(params);
			}
		}

		const serverMain = vscode.Uri.joinPath(context.extensionUri, 'dist/browser/server.js');
		const worker = new Worker(serverMain.toString());
		const clientOptions: lsp.LanguageClientOptions = {
			documentSelector: langs.map<lsp.DocumentFilter>(lang => ({ language: lang })),
			initializationOptions: initOptions,
			progressOnInitialization: true,
			synchronize: {
				fileEvents: vscode.workspace.createFileSystemWatcher(`{**/*.vue,${processMd() ? '**/*.md,' : ''}${processHtml() ? '**/*.html,' : ''}**/*.js,**/*.ts,**/*.cjs,**/*.cts,**/*.mjs,**/*.mts,**/*.jsx,**/*.tsx,**/*.json}`)
			},
			middleware,
		};
		const client = new _LanguageClient(
			id,
			name,
			clientOptions,
			worker,
		);
		await client.start();

		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}
