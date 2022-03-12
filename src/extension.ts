import * as vscode from 'vscode';
import { NamespaceHandler } from './core';

var namespaceHandler: NamespaceHandler | null = null;
var watcher : vscode.FileSystemWatcher | null = null;
var enabled = false;


export function activate(context: vscode.ExtensionContext) {
	const settingsEnabled = vscode.workspace.getConfiguration("vscode-jsdoc-namespace-workaround").get("activated");
	vscode.window.showInformationMessage(String(settingsEnabled));
	if(settingsEnabled) {
		enable(context);
	}
	vscode.commands.registerCommand("vscode-jsdoc-namespace-workaround.enable", () =>  {
		if(!enabled) {
			enable(context);
		}
	});
	vscode.commands.registerCommand("vscode-jsdoc-namespace-workaround.disable", () =>  {
		if(enabled) {
			disable();
		}
	});
}

export function deactivate() {
	disable();
}


function enable(context: vscode.ExtensionContext) {
	namespaceHandler = new NamespaceHandler();
	enabled = true;
	vscode.workspace.getConfiguration("vscode-jsdoc-namespace-workaround").update("activated", true);
	try {
		watcher = vscode.workspace.createFileSystemWatcher("**/*.js");
		vscode.workspace.onDidChangeWorkspaceFolders(event => {
			event.removed.forEach(workspaceFolder => namespaceHandler?.clearWorkspace(workspaceFolder));
			event.added.forEach(workspaceFolder => namespaceHandler?.addWorkspace(workspaceFolder));
		});
		vscode.workspace.workspaceFolders?.forEach(workspaceFolder => namespaceHandler?.addWorkspace(workspaceFolder));
		watcher.onDidChange(changeEvent => namespaceHandler?.processChange(changeEvent.fsPath));
		watcher.onDidCreate(changeEvent => namespaceHandler?.processChange(changeEvent.fsPath));
		watcher.onDidDelete(changeEvent => namespaceHandler?.processChange(changeEvent.fsPath));
	} catch (e) {
		vscode.window.showErrorMessage(String(e));
	}
}


function disable() {
	enabled = false;
	namespaceHandler = null;
	watcher?.dispose();
	vscode.workspace.getConfiguration("vscode-jsdoc-namespace-workaround").update("activated", false);
}
