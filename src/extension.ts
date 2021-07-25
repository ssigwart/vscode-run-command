import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import { startCommand } from './commandRunner';
import { ExecCommandResponse, RunCommand, RunCommandResults } from './runCommand';

/**
 * Activate
 *
 * @param {vscode.ExtensionContext} context Context
 */
export function activate(context: vscode.ExtensionContext): void
{
	addCommand(context, "run-command.runCommand", () => {
		const activeTextEditor = vscode.window.activeTextEditor;
		if (!activeTextEditor)
			vscode.window.showErrorMessage("Cannot run a command with no active text editor.");
		else
		{
			const selection = activeTextEditor.selection;

			// Create and show a new webview
			const panel = vscode.window.createWebviewPanel(
				'runCmd', // Identifies the type of the webview. Used internally
				'Run Command', // Title
				vscode.ViewColumn.Beside,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			// Get HTML
			const htmlPath = vscode.Uri.file(
				path.join(context.extensionPath, "src", "html" , "runCommandOptions.html")
			);
			const htmlPathUri = htmlPath.with({scheme: "vscode-resource"});
			panel.webview.html = fs.readFileSync(htmlPathUri.fsPath, "utf8");

			// Handle closing
			let disposed = false;
			let execCmdResp: ExecCommandResponse|undefined;
			let cmdCompleted = false;
			panel.onDidDispose(function() {
				disposed = true;

				// Kill process
				if (execCmdResp && !cmdCompleted)
				{
					execCmdResp.kill();
					vscode.window.showErrorMessage("Killed command because window was closed.");
				}
			});

			// Close if it loses focus and command hasn't started executing
			let closeOnBlur = true;
			panel.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
				if (closeOnBlur && !panel.active && !disposed && !execCmdResp)
					panel.dispose();
			});

			// Send history items
			let historyItems: string[] = context.globalState.get("history") ?? [];
			panel.webview.postMessage({
				type: "history",
				items: historyItems
			});

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(function (msg) {
					switch (msg.type)
					{
						// Run command
						case "run":
							const result = startCommand(msg, activeTextEditor, selection);
							result.then((runCmd: RunCommand) => {
								panel.title = "Run Command: " + runCmd.cmd;
								execCmdResp = runCmd.execCmdResp;

								// Update history items
								historyItems = historyItems.filter((val: string) => val !== runCmd.cmd);
								historyItems.unshift(runCmd.cmd);
								context.globalState.update("history", historyItems);

								// Wait for result
								if (runCmd.execCmdResp?.resultsPromise)
								{
									runCmd.execCmdResp.resultsPromise.then((runCmdResults: RunCommandResults) => {
										cmdCompleted = true;

										// Close window if output replaces text
										if (runCmd.outputReplacesSelection)
										{
											if (!disposed)
												panel.dispose();
										}
										else
										{
											closeOnBlur = false;
											// Share response back
											if (!disposed)
											{
												panel.webview.postMessage({
													type: "results",
													code: runCmdResults.code,
													stdout: runCmdResults.stdout,
													stderr: runCmdResults.stderr
												});
											}
										}
									}).catch((e) => {
										cmdCompleted = true;

										// Show error
										console.error(e);
										vscode.window.showErrorMessage("Command failed.", { detail: e});

										// Close window
										if (!disposed)
											panel.dispose();
									});
								}
							});
							break;
						// Cancel command
						case "cancel":
							// Cancel command
							execCmdResp?.kill();
							cmdCompleted = true;
							vscode.window.showErrorMessage("Cancelled command.");

							// Close window
							if (!disposed)
								panel.dispose();
							break;
						// Remove history item
						case "history-remove":
							const cmd = msg.cmd ?? "";
							if (cmd !== "")
							{
								// Remove from history
								historyItems = historyItems.filter((val: string) => val !== cmd);
								context.globalState.update("history", historyItems);
							}
							break;
					}
				},
				undefined,
				context.subscriptions
			);
		}
	});
}

/**
 * Deactivate
 */
export function deactivate(): void
{
}

/**
 * Add a command
 *
 * @param {vscode.ExtensionContext} context Context
 * @param {string} cmd Command
 */
function addCommand(context: vscode.ExtensionContext, cmd: string, func: () => void): void
{
	let disposable = vscode.commands.registerCommand(cmd, func);
	context.subscriptions.push(disposable);
}
