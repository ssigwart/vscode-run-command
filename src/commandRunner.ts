import { dirname } from 'path';
import * as vscode from 'vscode';
import { RunCommand, execCommand, RunCommandResults } from "./runCommand";

/**
 * Check if this is an expected result code for a command
 *
 * @param {string} cmd Command
 * @param {number} code Response code
 *
 * @return {boolean} True if expected
 */
function isExpectedCode(cmd: string, code: number): boolean
{
	if (/^e?grep\s/.exec(cmd) && code === 1)
		return true;
	return false;
}

export async function startCommand(msg: any, activeTextEditor: vscode.TextEditor, selection: vscode.Selection, outputChannel: vscode.OutputChannel): Promise<RunCommand> {
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
			if (results.code !== 0 && !isExpectedCode(msg.cmd, results.code))
			{
				vscode.window.showErrorMessage("Command finished with code " + results.code + ". See console for output.");
				if (results.stdout)
					outputChannel.appendLine(results.stdout);
				if (results.stderr)
					outputChannel.appendLine(results.stderr);
				else if (!results.stdout)
					outputChannel.appendLine("<Command failed with no output>");
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
					outputChannel.appendLine(results.stderr);
					vscode.window.showErrorMessage("Command send messages to stderr. See console for output.");
				}
			}
		});
	}

	// Output status
	vscode.window.setStatusBarMessage("Running command: " + runCmd.cmd, 2000);

	return runCmd;
}
