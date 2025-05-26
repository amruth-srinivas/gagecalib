// File: main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');
  
  // Open DevTools in development (optional)
  // mainWindow.webContents.openDevTools();
}

// When Electron is ready, create window
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle IPC events from renderer
ipcMain.on('print-label', (event, data) => {
  console.log('Print label request received:', data);
  // In a real app, this would connect to printer
  event.reply('print-complete', { success: true });
});