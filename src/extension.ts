// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";

function get_folder_path(uri:string){
	var folda_path = "";
	var slash = uri.lastIndexOf("/");
	var back_slash = uri.lastIndexOf("\\");
	if(slash > back_slash){
		folda_path = uri.substring(0, slash+1);
	}else if(slash < back_slash){
		folda_path = uri.substring(0, back_slash+1);
	}else{
		vscode.window.showInformationMessage(`No file or directory`);
	};
	return folda_path;
}

function puts_command(command:string){
	child_process.exec(command, (err, stdout, stderr) => {
		if (err) {
			vscode.window.showInformationMessage(`${stderr}`);
		  return;
		}
		vscode.window.showInformationMessage(`${stdout}`);
	  }
	);
}

function search_extension_files(folder_path:string, extension:string){
	var file_list = fs.readdirSync(folder_path);
	file_list = file_list.filter(function(file){
　　	return path.extname(file).toLowerCase() === extension;
　　});
	return file_list;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('extension.write', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = vscode.window.activeTextEditor;

		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var command = writeConfig.path + ` ` + writeConfig.option + ` `;
			var fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += folder_path + file_name + " ";
			});
			puts_command(command);
			vscode.window.showInformationMessage(command);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.build', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const d_uri = activeEditor.document.uri.fsPath;
			var command = mrbcConfig.path + ` ` + d_uri + ` ` + mrbcConfig.option;
			puts_command(command);
			vscode.window.showInformationMessage(command);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.all_build', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var fileList = search_extension_files(folder_path,".rb");
			fileList.forEach(function(file_name){
				var command = mrbcConfig.path + ` `
				command += folder_path + file_name + ` ` + mrbcConfig.option;
				puts_command(command);
				vscode.window.showInformationMessage(command);
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.build_write', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var fileList = search_extension_files(folder_path,".rb");
			var command = "";
			fileList.forEach(function(file_name){
				command = mrbcConfig.path + ` `
				command += folder_path + file_name + ` ` + mrbcConfig.option;
				puts_command(command);
				vscode.window.showInformationMessage(command);
			});
			command = writeConfig.path + ` ` + writeConfig.option + ` `;
			fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += folder_path + file_name + " ";
			});
			puts_command(command);
			vscode.window.showInformationMessage(command);
		}
	}));
}

export function deactivate() {}
