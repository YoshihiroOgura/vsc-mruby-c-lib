// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";
import * as SerialPort from "serialport";
import { performance } from "perf_hooks";
import { ReadlineParser } from '@serialport/parser-readline';
require('events').EventEmitter.defaultMaxListeners = 30;

const window = vscode.window;
var terminal:any = null; 
var serialWindow:any = null;
var port:any = SerialPort;
var buffer: string[] = [];
var lastFlushTime = Number.NEGATIVE_INFINITY;
var setDatap = false;
var txt ="";

function putsCommand(command:string) {
  if (terminal === null || terminal.exitStatus !== undefined) {
    terminal = window.createTerminal('mrubyc');
    if (process.platform == `win32`){
      terminal.sendText('REM mruby/c terminal', true);
    } else {
      terminal.sendText('# mruby/c terminal', true);
    };
  };
  terminal.show();
  terminal.sendText(command);
};

function outputSerial() {
  if (serialWindow === null) {
    serialWindow = window.createOutputChannel("mrubyc serial");
    serialWindow.appendLine('mruby/c serial output');
  };
};

function putsLog(text:string) {
  serialWindow.show();
  serialWindow.appendLine(text);
};

function searchExtensionFiles(folderPath:string, extension:string) {
  var fileList = fs.readdirSync(folderPath);
  fileList = fileList.filter(function(file) {
    return path.extname(file).toLowerCase() === extension;
  });
  return fileList;
};

function tryFlush() {
  const currentTime = performance.now();
  txt += buffer.join("");
  if (txt.length > 0 && currentTime - lastFlushTime > 100) {
    var cat:number = txt.lastIndexOf(`\n`);
    if (cat !== -1) {
      serialWindow.append(txt.slice(0, cat));
      txt = txt.slice(cat - txt.length);
    };
  };
  buffer = [];
  lastFlushTime = currentTime;
};

function sleep(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

async function messageCheck(checkTxt:string = "+") {
  let i = 0;
  var message =  "";
  for (i; i < 300; i++) {
    await sleep(10);
    message += port.read(1);
    if (message.includes("\n")) {
      if (message.includes(checkTxt)) {
        await port.flush();
        putsLog("command OK");
        break;
      }
    }
  }
  
  if (i === 300) {
    putsLog("over time");
  }
  await port.flush();
}

async function portOpen(portPath:string, baud:number) {
  if (!port.isOpen) {
    await new Promise<void>((resolve, reject) => {
      port = new SerialPort.SerialPort( {
        autoOpen: true,
        path: portPath,
        baudRate: baud
      },(err) => {
        if (err) {
          putsLog(err.message); 
          reject(err);
        };
      });
      port.open((err:Error) => {
        if (err) {
          putsLog(err.message);
          reject(err);
        };
      });
      port.pipe(new ReadlineParser( {delimiter: '\n'}));
      port.flush();
      setDatap = true;
      port.on("data", (data:string) => {
        buffer.push(data);
        tryFlush();
      });
      resolve();
    });
  };
};

async function mrbWrite(portPath:string, folderPath:string) {
  var fileList = searchExtensionFiles(folderPath, ".mrb");
  var datas:Buffer = Buffer.alloc(0); // 修正: Buffer.alloc() を使用
  
  port.flush();
  port.pause();

  for (var i=0; i<15; i++) {
    await new Promise<void>(resolve => {
      port.write("\n", () => {
        port.drain(() => {
          putsLog(".");
          setTimeout(resolve, 1000);
        });
      });
    });
    var moji = port.read(5);
    if (moji !== null) {
      if (moji.includes('\n')) {break;};
    } else {
      port.open();
    };
  };
  await port.flush();

  
  putsLog("send cliar command");
  port.write("clear\n");
  await messageCheck("+OK");

  for (let i = 0; i < fileList.length; i++) {
    var filePath = path.join(folderPath, fileList[i]);
    datas = fs.readFileSync(filePath);
    putsLog(`write ${fileList[i]}`);
    port.write(`write ${datas.length}\n`);
    await messageCheck("+OK");
    port.write(datas);
    await messageCheck("+DONE");
  }

  putsLog("execute");
  port.write("execute\n");
  await messageCheck("+OK");
  await port.flush();
  port.resume();
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.serial', () => {
    const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
    outputSerial();
    portOpen(writeConfig.serialport, writeConfig.baud);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.serialclose', () => {
    if (port.isOpen && setDatap) {
      setDatap = false;
      port.off("data", (data:string) => {
        buffer.push(data);
        tryFlush();
      });
      putsLog('Serial Port ' + port.path + ' is close.');
      port.close();
    };
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.write', () => {
    const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
    const folders = vscode.workspace.workspaceFolders;
    outputSerial();
    portOpen(writeConfig.serialport, writeConfig.baud);
    if (folders === undefined) {
      window.showInformationMessage(`No workspace folders found.`);
    } else if (folders.length === 1) {
      const folderPath = (folders[0]).uri.fsPath;
      mrbWrite(writeConfig.serialport,folderPath);
    } else {
      window.showInformationMessage(`Too many workspace folders.`);
    };
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.build', () => {
    const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
    const activeEditor = window.activeTextEditor;
    if (activeEditor) {
      const documentUri = activeEditor.document.uri.fsPath;
      var command = mrbcConfig.path + ` ` + documentUri + ` ` + mrbcConfig.option;
      putsCommand(command);
    };
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.all_build', () => {
    const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
    const folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) {
      window.showInformationMessage(`No workspace folders found.`);
    } else if (folders.length === 1) {
      const folderPath = (folders[0]).uri.fsPath;
      var fileList = searchExtensionFiles(folderPath, ".rb");
      fileList.forEach(function(fileName) {
        var command = mrbcConfig.path + ` `;
        command += path.join(folderPath, fileName);
        command += ` ` + mrbcConfig.option;
        putsCommand(command);
      });
    } else {
      window.showInformationMessage(`Too many workspace folders.`);
    };
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.build_write', () => {
    const mrbcConfig = vscode.workspace.getConfiguration('mrubyc.mrbc');
    const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
    const folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) {
      window.showInformationMessage(`Too many workspace folders.`);
    } else if (folders.length === 1) {
      new Promise<void>(async resolve => {
        const folderPath = (folders[0]).uri.fsPath;
        var fileList = searchExtensionFiles(folderPath, ".rb");
        var command = "";
        for (const fileName of fileList) {
          command = mrbcConfig.path + ` `;
          command += path.join(folderPath ,fileName);
          command += ` ` + mrbcConfig.option;
          await putsCommand(command);
        }
        outputSerial();
        await sleep(1000);
        await portOpen(writeConfig.serialport, writeConfig.baud);
        await mrbWrite(writeConfig.serialport,folderPath);
        resolve();
      });
    } else {
      window.showInformationMessage(`Too many workspace folders.`);
    };
  }));
};

export function deactivate() {};
