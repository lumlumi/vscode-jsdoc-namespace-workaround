import * as vscode from 'vscode';
import { NamespaceHandler } from './core';

var namespaceHandler: NamespaceHandler | null = null;


export function activate(context: vscode.ExtensionContext) {
	try {
		namespaceHandler = new NamespaceHandler();
		vscode.workspace.createFileSystemWatcher("**/*.js");
		vscode.workspace.onDidSaveTextDocument(event => {
			namespaceHandler?.processChange(event.uri);
		});
		vscode.workspace.onDidChangeWorkspaceFolders(event => {
			event.removed.forEach(workspaceFolder => namespaceHandler?.clearWorkspace(workspaceFolder));
			event.added.forEach(workspaceFolder => namespaceHandler?.addWorkspace(workspaceFolder));
		});
		vscode.workspace.workspaceFolders?.forEach(workspaceFolder => namespaceHandler?.addWorkspace(workspaceFolder));
	} catch (e) {
		vscode.window.showErrorMessage(String(e));
	}
}

export function deactivate() {
	namespaceHandler = null;

}
