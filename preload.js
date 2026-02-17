// preload.js - Безопасный мост между renderer и main процессами
const { contextBridge, ipcRenderer } = require('electron');

// Экспортируем безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Работа с водителями
  getDrivers: () => ipcRenderer.invoke('get-drivers'),
  saveDrivers: (drivers) => ipcRenderer.invoke('save-drivers', drivers),

  // Работа с шаблонами
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  uploadTemplate: () => ipcRenderer.invoke('upload-template'),
  deleteTemplate: (templateName) => ipcRenderer.invoke('delete-template', templateName),
  readTemplate: (templateName) => ipcRenderer.invoke('read-template', templateName),

  // Работа с путевыми листами
  saveWaybill: (pdfBytes, driverName) => ipcRenderer.invoke('save-waybill', pdfBytes, driverName),
  generateWaybill: (templateName, driver, waybillData) => ipcRenderer.invoke('generate-waybill', templateName, driver, waybillData),
  openGeneratedFolder: () => ipcRenderer.invoke('open-generated-folder'),

  // Координатный маппинг полей
  getFieldMapping: (templateName) => ipcRenderer.invoke('get-field-mapping', templateName),
  saveFieldMapping: (templateName, mapping) => ipcRenderer.invoke('save-field-mapping', templateName, mapping)
});
