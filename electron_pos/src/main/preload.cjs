const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cafe', { call:(method,data)=>ipcRenderer.invoke('cafe:call',method,data), platform:'electron' });
