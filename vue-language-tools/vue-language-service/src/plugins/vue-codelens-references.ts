import * as vscode from 'vscode-languageserver-protocol';
import { LanguageServicePlugin, LanguageServicePluginContext, SourceFileDocument } from '@volar/language-service';

const showReferencesCommand = 'volar.show-references';

export const commands = [showReferencesCommand];

type CommandArgs = [string, vscode.Position, vscode.Location[]];

export interface ReferencesCodeLensData {
	uri: string,
	position: vscode.Position,
}

export default function (options: {
	getVueDocument(uri: string): SourceFileDocument | undefined,
	findReference(uri: string, position: vscode.Position): Promise<vscode.Location[] | undefined>,
}): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		codeLens: {

			on(document) {
				return worker(document.uri, async (vueDocument) => {

					const isEnabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.codeLens.references') ?? true;

					if (!isEnabled)
						return;

					const result: vscode.CodeLens[] = [];

					for (const sourceMap of vueDocument.getSourceMaps()) {
						for (const mapping of sourceMap.mappings) {

							if (!mapping.data.referencesCodeLens)
								continue;

							result.push({
								range: {
									start: document.positionAt(mapping.sourceRange[0]),
									end: document.positionAt(mapping.sourceRange[1]),
								},
								data: {
									uri: document.uri,
									position: document.positionAt(mapping.sourceRange[0]),
								} satisfies ReferencesCodeLensData,
							});
						}
					}

					return result;
				});
			},

			async resolve(codeLens) {

				const data: ReferencesCodeLensData = codeLens.data;
				const vueDocument = options.getVueDocument(data.uri);

				if (!vueDocument)
					return codeLens;

				const sourceMaps = vueDocument.getSourceMaps();
				const currentSourceMap = sourceMaps.find(sourceMap => sourceMap.toGeneratedPosition(data.position));
				const references = await options.findReference(data.uri, data.position) ?? [];
				const referencesInDifferentDocument = references.filter(reference =>
					reference.uri !== data.uri // different file
					|| sourceMaps.some(sourceMap => sourceMap.toGeneratedPosition(reference.range.start) && sourceMap !== currentSourceMap) // different embedded document
				);
				const referencesCount = referencesInDifferentDocument.length ?? 0;

				codeLens.command = {
					title: referencesCount === 1 ? '1 reference' : `${referencesCount} references`,
					command: showReferencesCommand,
					arguments: <CommandArgs>[data.uri, codeLens.range.start, references],
				};

				return codeLens;
			},
		},

		doExecuteCommand(command, args, context) {

			if (command === showReferencesCommand) {

				const [uri, position, references] = args as CommandArgs;

				context.showReferences({
					textDocument: { uri },
					position,
					references,
				});
			}
		},
	};

	function worker<T>(uri: string, callback: (vueDocument: SourceFileDocument) => T) {

		const vueDocument = options.getVueDocument(uri);
		if (!vueDocument)
			return;

		return callback(vueDocument);
	}
}
