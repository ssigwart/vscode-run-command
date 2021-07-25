import * as child_process from "child_process";
import { Selection } from "vscode";

/** Run command */
export interface RunCommand {
	cmd: string;
	cwd: string;
	selectionAsInput: boolean;
	outputReplacesSelection: boolean;
	selection: Selection;
	input: string;
	execCmdResp?: ExecCommandResponse;
}

/** Run command results */
export interface RunCommandResults {
	stdout: string;
	stderr: string;
	code: number;
}

export interface ExecCommandResponse {
	kill: () => void;
	resultsPromise: Promise<RunCommandResults>;
}

/**
 * Execute a command
 *
 * @param {string} command Command to run
 * @param {string[]} args Arguments
 * @param {string} dir Directory
 * @param {string} stdin Stdin input
 * @param {boolean} asShell Run in shell mode
 *
 * @return {ExecCommandResponse}
 */
export function execCommand(command: string, args: string[], dir: string, stdin: string, asShell: boolean): ExecCommandResponse {
	const child = child_process.spawn(command, args, { cwd: dir, shell: asShell });
	return {
		kill: function() {
			child.kill(9);
		},
		resultsPromise: new Promise(function (resolve: (value: RunCommandResults) => void, reject: (reason: any) => void) {
			let stderr = "";
			let stdout = "";
			child.stdin.write(stdin);
			child.stdin.end();
			child.stdout.on('data', (data) => {
				stdout += data;
			});
			child.stderr.on('data', (data) => {
				stderr += data;
			});
			child.on('error', (err: Error) => {
				reject(err.message);
			});
			child.on('close', (code) => {
				resolve({
					stdout: stdout,
					stderr: stderr,
					code: code
				});
			});
		})
	};
}
