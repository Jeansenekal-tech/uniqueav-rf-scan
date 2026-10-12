'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let win = null;
let manualCheck = false;

// tinySA (all models) enumerate as the STM32 virtual COM port 0483:5740
// (Electron reports IDs as strings; accept decimal or hex spellings)
const isTinySA = p => {
  const v = String(p.vendorId || '').toLowerCase(), d = String(p.productId || '').toLowerCase();
  return ['1155', '0483', '483', '0x0483', '0x483'].includes(v) && ['22336', '5740', '0x5740'].includes(d);
};
const portLabel = p => `${p.displayName || p.portName || 'Serial port'}${p.portName && p.displayName ? ' (' + p.portName + ')' : ''}`;

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'Unique AV RF Scan', backgroundColor: '#0d1117', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  const ses = win.webContents.session;

  // ----- Web Serial support -----
  ses.on('select-serial-port', async (event, portList, webContents, callback) => {
    event.preventDefault();
    if (!portList.length) { callback(''); return; }
    const tiny = portList.filter(isTinySA);
    if (tiny.length === 1) { callback(tiny[0].portId); return; }
    const choices = tiny.length ? tiny : portList;
    const { response } = await dialog.showMessageBox(win, {
      type: 'question', title: 'Choose serial port', message: 'Which port is the tinySA on?',
      buttons: [...choices.map(portLabel), 'Cancel'], cancelId: choices.length, noLink: true
    });
    callback(response < choices.length ? choices[response].portId : '');
  });
  ses.setPermissionCheckHandler((wc, permission) => permission === 'serial' || permission === 'fileSystem' || permission === 'clipboard-sanitized-write');
  ses.setDevicePermissionHandler(details => details.deviceType === 'serial');

  // Save exported files with a proper "Save as" dialog
  ses.on('will-download', (event, item) => {
    const p = dialog.showSaveDialogSync(win, { defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
    if (p) item.setSavePath(p); else item.cancel();
  });

  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

// ----- auto updates -----
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
autoUpdater.on('checking-for-update', () => send('update', { state: 'checking' }));
autoUpdater.on('update-available', info => send('update', { state: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => {
  send('update', { state: 'none' });
  if (manualCheck) dialog.showMessageBox(win, { type: 'info', message: 'You have the latest version', detail: 'Unique AV RF Scan ' + app.getVersion() });
  manualCheck = false;
});
autoUpdater.on('download-progress', p => send('update', { state: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', info => { send('update', { state: 'ready', version: info.version }); manualCheck = false; });
autoUpdater.on('error', err => {
  log.error(err); send('update', { state: 'error', message: String(err && err.message || err) });
  if (manualCheck) dialog.showMessageBox(win, { type: 'warning', message: 'Could not check for updates', detail: String(err && err.message || err) });
  manualCheck = false;
});
function checkForUpdates(manual) {
  if (!app.isPackaged) { if (manual) dialog.showMessageBox(win, { message: 'Updates only work in the installed app.' }); return; }
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch(e => log.error(e));
}
ipcMain.handle('app-info', () => ({ version: app.getVersion(), platform: process.platform, packaged: app.isPackaged }));
ipcMain.handle('update-check', () => checkForUpdates(true));
ipcMain.handle('update-install', () => autoUpdater.quitAndInstall());

// ----- menu -----
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const checkItem = { label: 'Check for Updates…', click: () => checkForUpdates(true) };
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, checkItem, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [...(isMac ? [] : [checkItem, { type: 'separator' }]), { label: 'Open log folder', click: () => shell.showItemInFolder(log.transports.file.getFile().path) }, { label: 'Version ' + app.getVersion(), enabled: false }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    buildMenu(); createWindow();
    setTimeout(() => checkForUpdates(false), 4000);
    setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
