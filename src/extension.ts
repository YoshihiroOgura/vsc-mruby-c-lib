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
var port:any = SerialPort;
var buffer: string[] = [];
var lastFlushTime = Number.NEGATIVE_INFINITY;
var set_datap = false;

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
	if (buffer.length > 0 && currentTime - lastFlushTime > 300) {
		sirial_window.append(buffer.join(""));
		lastFlushTime = currentTime;
		buffer = [];
	}
}
async function portOpen(port_path:string){
	if (!port.isOpen){
		await new Promise<void>((resolve, reject) => {
			port = new SerialPort.SerialPort({
				path: port_path,
				baudRate: 19200},
				(err) => {
          if (err) {
						puts_log(err.message); 
						reject(err);
					}
        }
			);
			port.open((err:Error) => {
        if (err) {
          puts_log(err.message);
					reject(err);
        } else {
					puts_log('Serial Port '+port_path+' is opened.');
				}
			});
			port.pipe(new ReadlineParser({ delimiter: '\n' }))
			resolve();
		});
	};
}

function mrb_write(port_path:string,folder_path:string){
	var fileList = search_extension_files(folder_path,".mrb");
	fileList.forEach(function(file_name){
		var file_path = folder_path + file_name;
		fs.readFile(file_path,(err, data) => {
			if (err) throw err;
			console.log(data);
		});
	});
}

async function sleep(time:number) {
	return await new Promise<void>((resolve, reject) => {
			setTimeout(() => {
					resolve();
			}, time);
	});
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('extension.serial', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		output_sirial();
		portOpen(writeConfig.serialport);
		if(port.isOpen && !set_datap){
			set_datap = true;
			port.on("data", (data:string) => {
				buffer.push(data);
				tryFlush();
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.consolewrite', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const activeEditor = window.activeTextEditor;
		output_sirial();
		portOpen(writeConfig.serialport);

		if (activeEditor) {
			const f_uri = activeEditor.document.uri.fsPath;
			// const folder_path = get_folder_path(f_uri);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.write', () => {
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const folders = vscode.workspace.workspaceFolders;
		if(folders === undefined){
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		} else if (folders.length === 1) {
			const folder_path = (folders[0]).uri.fsPath;
			var command = writeConfig.path + ` `;
			command += `-l ` + writeConfig.serialport + ` `;
			command += writeConfig.option + ` `;
			var fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += path.join(folder_path, file_name) + " ";
			});
			puts_command(command);
		}else{
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		};
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
		const folders = vscode.workspace.workspaceFolders;
		if(folders === undefined){
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		} else if (folders.length === 1) {
			const folder_path = (folders[0]).uri.fsPath;
			var fileList = search_extension_files(folder_path,".rb");
			fileList.forEach(function(file_name){
				var command = mrbcConfig.path + ` `
				command += path.join(folder_path ,file_name);
				command += ` ` + mrbcConfig.option;
				puts_command(command);
			});
		}else{
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		};
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.build_write', () => {
		const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
		const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
		const folders = vscode.workspace.workspaceFolders;
		if(folders === undefined){
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		} else if (folders.length === 1) {
			const folder_path = (folders[0]).uri.fsPath;
			var fileList = search_extension_files(folder_path,".rb");
			var command = "";
			fileList.forEach(function(file_name){
				command = mrbcConfig.path + ` `
				command += path.join(folder_path ,file_name);
				command += ` ` + mrbcConfig.option;
				puts_command(command);
			});
			sleep(1000);
			command = writeConfig.path + ` `;
			command += `-l ` + writeConfig.serialport + ` `;
			command += writeConfig.option + ` `;
			fileList = search_extension_files(folder_path,".mrb");
			fileList.forEach(function(file_name){
				command += path.join(folder_path, file_name) + " ";
			});
			puts_command(command);
		}else{
			vscode.window.showInformationMessage(`Too many workspace folders.`);
		};
	}));
}

export function deactivate() {}
