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
    var cat:number =txt.lastIndexOf(`\n`);
    if (cat !== -1) {
      //serialWindow.appendLine(txt);
      serialWindow.append(txt.slice(0, cat));
      txt = txt.slice(cat - txt.length);
    };
  };
  buffer = [];
  lastFlushTime = currentTime;
};

async function portOpen(portPath:string) {
  if (!port.isOpen) {
    await new Promise<void>((resolve, reject) => {
      port = new SerialPort.SerialPort( {
        autoOpen: true,
        path: portPath,
        baudRate: 19200
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
        // txt = data;
        tryFlush();
      });
      resolve();
    });
  };
};

async function mrbWrite(portPath:string, folderPath:string) {
  var fileList = searchExtensionFiles(folderPath, ".mrb");
  var datas:Buffer = new Buffer(0);
  await Promise.all(
    fileList.map(async fileName => {
      var filePath = path.join(folderPath, fileName);
      datas = fs.readFileSync(filePath);
      return datas;
    })
  );
  port.flush();
  port.pause();
  await new Promise<void>(async resolve => {
    for (var i=0; i<15; i++) {
      await new Promise<void>(async resolve => {
        await port.write("\n");
        await port.drain();
        await putsLog(".");
        await setTimeout(resolve, 1000);
      });
      var moji = port.read(13);
      if (moji !== null) {
        if (moji.indexOf('\n') != -1) {break;};
      } else {
        port.open();
      };
    };
    await port.flush();
    putsLog("send write command");
    port.write(`write ${datas.length}\n`);
    for (var i=0; i<30; i++) {
      await new Promise<void>(async resolve => {
        setTimeout(resolve, 100);
      });
      var moji = port.read(20);
      if (moji !== null) {
        if (moji.indexOf('+') != -1) {
          await port.flush();
          putsLog("write datas");
          break;
        };
      };
    };
    port.write(datas);
    putsLog("execute");
    port.write("execute\n");
    await port.flush();
    port.resume();
    resolve();
  });
};

async function sleep(time:number) {
  return await new Promise<void>(resolve => {
      setTimeout(() => {
        putsLog("timeout");
        resolve();
      }, time);
  });
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.serial', () => {
    const writeConfig = vscode.workspace.getConfiguration('mrubyc.write');
    outputSerial();
    portOpen(writeConfig.serialport);
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
    portOpen(writeConfig.serialport);
    if (folders === undefined) {
      window.showInformationMessage(`Too many workspace folders.`);
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
      window.showInformationMessage(`Too many workspace folders.`);
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
        await fileList.forEach(async function(fileName) {
          var filePath = path.join(folderPath ,fileName);
          command = mrbcConfig.path + ` `;
          command += path.join(folderPath ,fileName);
          command += ` ` + mrbcConfig.option;
          await putsCommand(command);
        });
        await outputSerial();
        await new Promise<void>(async resolve => {
          await setTimeout(resolve, 1000);
        });
        await portOpen(writeConfig.serialport);
        await mrbWrite(writeConfig.serialport,folderPath);
        resolve();
      });
    } else {
      window.showInformationMessage(`Too many workspace folders.`);
    };
  }));
};

export function deactivate() {};
