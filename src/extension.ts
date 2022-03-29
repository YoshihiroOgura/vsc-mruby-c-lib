// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";
import * as SerialPort from "serialport";
import { performance } from "perf_hooks";
import { ReadlineParser } from '@serialport/parser-readline';
//var SerialPort = require('serialport');
const window = vscode.window;
var terminal:any = null; 
var sirial_window:any = null;
var port:any = null;
var buffer: string[] = [];
var lastFlushTime = Number.NEGATIVE_INFINITY;

function get_folder_path(uri:string){
	var folda_path = "";
	const slash = uri.lastIndexOf("/");
	const back_slash = uri.lastIndexOf("\\");
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
	if (terminal === null) {
		terminal = window.createTerminal('mrubyc');
		terminal.sendText('# mruby/c terminal', true);
	}
	terminal.show();
	terminal.sendText(command);
}

function output_sirial(){
	if (sirial_window === null){
		sirial_window = window.createOutputChannel("mrubyc serial");
		sirial_window.appendLine('mruby/c serial output');
	}
}

function puts_log(text:string){
	sirial_window.show();
	sirial_window.appendLine(text);
}

function search_extension_files(folder_path:string, extension:string){
	var file_list = fs.readdirSync(folder_path);
	file_list = file_list.filter(function(file){
		return path.extname(file).toLowerCase() === extension;
	});
	return file_list;
}
function tryFlush() {
	const currentTime = performance.now();
	if (buffer.length > 0 && currentTime - lastFlushTime > 100) {
		sirial_window.append(buffer.join(""));
		lastFlushTime = currentTime;
		buffer = [];
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('extension.serial', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		output_sirial();
		new Promise<void>((resolve, reject) => {
			port = new SerialPort.SerialPort({
				path: writeConfig.serialport,
				baudRate: 19200}
			);
			port.on('open',function() {
				puts_log('Serial Port '+writeConfig.serialport+' is opened.');
			});
			port.pipe(new ReadlineParser({ delimiter: '\n' }))
			port.on("data", (data:string) => {
				buffer.push(data);
				tryFlush();
			});
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.consolewrite', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = window.activeTextEditor;

		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.write', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = window.activeTextEditor;

		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var command = writeConfig.path + ` `;
			command += `-l ` + writeConfig.serialport + ` `;
			command += writeConfig.option + ` `;
			var fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += folder_path + file_name + " ";
			});
			puts_command(command);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.build', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const activeEditor = window.activeTextEditor;
		if (activeEditor) {
			const d_uri = activeEditor.document.uri.fsPath;
			var command = mrbcConfig.path + ` ` + d_uri + ` ` + mrbcConfig.option;
			puts_command(command);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.all_build', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const activeEditor = window.activeTextEditor;
		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var fileList = search_extension_files(folder_path,".rb");
			fileList.forEach(function(file_name){
				var command = mrbcConfig.path + ` `
				command += folder_path + file_name + ` ` + mrbcConfig.option;
				puts_command(command);
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.build_write', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = window.activeTextEditor;
		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			const folder_path = get_folder_path(f_uri);
			var fileList = search_extension_files(folder_path,".rb");
			var command = "";
			fileList.forEach(function(file_name){
				command = mrbcConfig.path + ` `
				command += folder_path + file_name + ` ` + mrbcConfig.option;
				puts_command(command);
			});
			command = writeConfig.path + ` `;
			command += `-l ` + writeConfig.serialport + ` `;
			command += writeConfig.option + ` `;
			fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += folder_path + file_name + " ";
			});
			puts_command(command);
		}
	}));
}

export function deactivate() {}
