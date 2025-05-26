// File: preload.js
// This file is executed before the renderer process starts
// It can expose Node.js functionality to the renderer

window.addEventListener('DOMContentLoaded', () => {
  const { ipcRenderer } = require('electron');
  
  // Expose IPC functionality to the renderer process
  window.electronAPI = {
    printLabel: (data) => ipcRenderer.send('print-label', data),
    onPrintComplete: (callback) => {
      ipcRenderer.on('print-complete', (event, result) => callback(result));
    }
  };
  
  console.log('Preload script has run');
});