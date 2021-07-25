import { dirname } from 'path';
import * as vscode from 'vscode';
import { RunCommand, execCommand, RunCommandResults } from "./runCommand";

export async function startCommand(msg: any, activeTextEditor: vscode.TextEditor, selection: vscode.Selection): Promise<RunCommand> {
	// Get input
	const selectionAsInput = !!(msg.selectionAsInput);
	const input = selectionAsInput ? (activeTextEditor.document.getText(selection) ?? "") : "";

	// Get directory
	let cwd = ".";
	if (activeTextEditor.document.uri.scheme === "file")
		cwd = dirname(activeTextEditor.document.uri.fsPath);

	// Set up command
	let runCmd: RunCommand = {
		cmd: msg.cmd || "",
		cwd: cwd,
		selectionAsInput: selectionAsInput,
		outputReplacesSelection: !!(msg.outputReplacesSelection),
		selection: selection,
		input: input
	};

	// Check command
	if (typeof msg.cmd !== "string" || msg.cmd === "")
		throw new Error("Invalid command.");

	// Execute command
	runCmd.execCmdResp = execCommand(runCmd.cmd, [], cwd, input, true);

	// Set up text replacement
	if (runCmd.outputReplacesSelection)
	{
		runCmd.execCmdResp.resultsPromise.then((results: RunCommandResults) => {
			if (results.code !== 0)
			{
				vscode.window.showErrorMessage("Command finished with code " + results.code + ". See console for output.");
				if (results.stdout)
					console.error(results.stdout);
				if (results.stderr)
					console.error(results.stderr);
				else if (!results.stdout)
					console.error("<Command failed with no output>");
			}
			else
			{
				// Set stdout
				activeTextEditor.edit(function(editBuilder: vscode.TextEditorEdit) {
					editBuilder.replace(selection, results.stdout);
				});
				vscode.window.setStatusBarMessage("Command finished.", 1000);

				// Check for error
				if (results.stderr)
				{
					console.error(results.stderr);
					vscode.window.showErrorMessage("Command send messages to stderr. See console for output.");
				}
			}
		});
	}

	// Output status
	vscode.window.setStatusBarMessage("Running command: " + runCmd.cmd, 2000);

	return runCmd;
}
