// main.js - Главный процесс Electron
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Путь к папке с данными
const dataPath = app.isPackaged 
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, 'data');

// Создаем необходимые папки при запуске
function createDataFolders() {
  const folders = [
    dataPath,
    path.join(dataPath, 'templates'),
    path.join(__dirname, 'generated')
  ];
  
  folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });
  
  // Создаем файл drivers.json если его нет
  const driversFile = path.join(dataPath, 'drivers.json');
  if (!fs.existsSync(driversFile)) {
    fs.writeFileSync(driversFile, JSON.stringify([], null, 2));
  }
}

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Безопасные настройки Electron
      nodeIntegration: false,        // ВАЖНО: отключаем прямой доступ к Node.js
      contextIsolation: true,         // ВАЖНО: изолируем контекст
      preload: path.join(__dirname, 'preload.js')  // Используем preload для безопасного API
    }
  });

  mainWindow.loadFile('index.html');

  // Открываем DevTools только в режиме разработки
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createDataFolders();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// === IPC обработчики ===

// Получить список водителей
ipcMain.handle('get-drivers', async () => {
  try {
    const driversFile = path.join(dataPath, 'drivers.json');
    const data = fs.readFileSync(driversFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка чтения водителей:', error);
    return [];
  }
});

// Сохранить список водителей
ipcMain.handle('save-drivers', async (event, drivers) => {
  try {
    const driversFile = path.join(dataPath, 'drivers.json');
    fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    return { success: false, error: error.message };
  }
});

// Получить список шаблонов
ipcMain.handle('get-templates', async () => {
  try {
    const templatesDir = path.join(dataPath, 'templates');
    const files = fs.readdirSync(templatesDir);
    return files.filter(file => file.endsWith('.pdf'));
  } catch (error) {
    return [];
  }
});

// Загрузить шаблон
ipcMain.handle('upload-template', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const destPath = path.join(dataPath, 'templates', fileName);
    
    try {
      fs.copyFileSync(sourcePath, destPath);
      return { success: true, fileName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false };
});

// Прочитать шаблон
ipcMain.handle('read-template', async (event, templateName) => {
  try {
    const templatePath = path.join(dataPath, 'templates', templateName);
    const pdfBytes = fs.readFileSync(templatePath);
    return { success: true, data: Array.from(pdfBytes) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Сохранить путевой лист
ipcMain.handle('save-waybill', async (event, pdfBytes, driverName) => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `${driverName}_${timestamp}.pdf`;
    const generatedDir = path.join(__dirname, 'generated');
    const filePath = path.join(generatedDir, fileName);
    
    fs.writeFileSync(filePath, Buffer.from(pdfBytes));
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Открыть папку с файлами
ipcMain.handle('open-generated-folder', async () => {
  const { shell } = require('electron');
  const generatedDir = path.join(__dirname, 'generated');
  shell.openPath(generatedDir);
});

// Удалить шаблон
ipcMain.handle('delete-template', async (event, templateName) => {
  try {
    const templatePath = path.join(dataPath, 'templates', templateName);
    fs.unlinkSync(templatePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Сгенерировать путевой лист (заполнить PDF и сохранить)
ipcMain.handle('generate-waybill', async (_event, templateName, driver, waybillData) => {
  try {
    const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
    const fontkit = require('@pdf-lib/fontkit');

    // Читаем шаблон
    const templatePath = path.join(dataPath, 'templates', templateName);
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // Загружаем шрифт с поддержкой кириллицы (нужен для обеих веток)
    let cyrFont;
    for (const fp of [
      process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts', 'arial.ttf') : null,
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/times.ttf',
    ].filter(Boolean)) {
      if (fs.existsSync(fp)) {
        cyrFont = await pdfDoc.embedFont(fs.readFileSync(fp));
        break;
      }
    }
    if (!cyrFont) cyrFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Значения для подстановки
    const licenseDate = driver.licenseDate ? driver.licenseDate.split('-').reverse().join('.') : '';
    const licenseStr = [driver.licenseSerial, driver.licenseNumber, licenseDate].filter(Boolean).join(' ') || driver.license || '';
    const dataValues = {
      'fio':            `${driver.lastName} ${driver.firstName} ${driver.middleName || ''}`.trim(),
      'lastName':       driver.lastName || '',
      'firstName':      driver.firstName || '',
      'middleName':     driver.middleName || '',
      'license':        licenseStr,
      'licenseSerial':  driver.licenseSerial || '',
      'licenseNumber':  driver.licenseNumber || '',
      'licenseDate':    driver.licenseDate || '',
      'snils':          driver.snils || '',
      'date':           waybillData.date || '',
      'number':         waybillData.number || '',
      'vehicleModel':   waybillData.vehicleModel || '',
      'vehicleNumber':  waybillData.vehicleNumber || '',
      'departurePoint': waybillData.departurePoint || '',
      'destination':    waybillData.destination || '',
      'departureTime':  waybillData.departureTime || '',
      'returnTime':     waybillData.returnTime || '',
      'odometerStart':  String(waybillData.odometerStart || ''),
      'odometerEnd':    String(waybillData.odometerEnd || ''),
      'route':          waybillData.route || '',
    };

    // Проверяем наличие координатного маппинга
    const mappingPath = path.join(dataPath, 'templates', templateName + '.mapping.json');
    if (fs.existsSync(mappingPath)) {
      const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      if (mapping.fields && mapping.fields.length > 0) {
        const pages = pdfDoc.getPages();
        let filled = 0;
        for (const field of mapping.fields) {
          const page = pages[field.page] || pages[0];
          const { width, height } = page.getSize();
          const pageRotation = page.getRotation().angle; // 0, 90, 180, 270
          const fontSize = field.fontSize || 10;
          let x = field.pdfX !== undefined ? field.pdfX : field.xRatio * width;
          let y = field.pdfY !== undefined ? field.pdfY : (1 - field.yRatio) * height;

          // Baseline-коррекция зависит от поворота страницы
          if (pageRotation === 90)       { x -= fontSize; }
          else if (pageRotation === 270) { x += fontSize; }
          else if (pageRotation === 180) { y += fontSize; }
          else                           { y -= fontSize; }

          const text = dataValues[field.dataKey] || '';
          if (text) {
            // Поворачиваем текст обратно, чтобы он был читаемым при любой ориентации страницы
            page.drawText(text, {
              x, y, size: fontSize, font: cyrFont,
              rotate: degrees(pageRotation)
            });
            filled++;
          }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const fileName = `${driver.lastName}_${driver.firstName}_${timestamp}.pdf`;
        const filePath = path.join(__dirname, 'generated', fileName);
        fs.writeFileSync(filePath, modifiedPdfBytes);
        return { success: true, filePath, fileName, usedMapping: true, fieldsFilled: filled };
      }
    }

    // Заполнение AcroForm-полей: читаем координаты из виджетов,
    // рисуем текст напрямую на странице, затем удаляем все виджет-аннотации.
    const { PDFName, PDFArray } = require('pdf-lib');
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const pages = pdfDoc.getPages();

    // Карта: строковое представление ref страницы -> индекс страницы
    const pageRefMap = new Map();
    pages.forEach((page, idx) => pageRefMap.set(page.ref.toString(), idx));

    const fieldMappings = {
      'driver_lastname': driver.lastName, 'driver_firstname': driver.firstName,
      'driver_middlename': driver.middleName,
      'driver_fio': dataValues.fio, 'fio': dataValues.fio,
      'license_serial': driver.licenseSerial || '',
      'license_date': driver.licenseDate || '',
      'license_number': licenseStr,
      'license': licenseStr,
      'snils': driver.snils || '',
      'waybill_date': waybillData.date, 'date': waybillData.date,
      'waybill_number': waybillData.number, 'number': waybillData.number,
      'vehicle_model': waybillData.vehicleModel, 'vehicle': waybillData.vehicleModel,
      'vehicle_number': waybillData.vehicleNumber, 'reg_number': waybillData.vehicleNumber,
      'departure_point': waybillData.departurePoint, 'destination': waybillData.destination,
      'departure_time': waybillData.departureTime, 'return_time': waybillData.returnTime,
      'odometer_start': String(waybillData.odometerStart || ''),
      'odometer_end': String(waybillData.odometerEnd || ''),
      'route': waybillData.route, 'task': waybillData.route
    };

    let filledCount = 0;
    fields.forEach(field => {
      const fieldName = field.getName().toLowerCase();
      for (const [key, value] of Object.entries(fieldMappings)) {
        if (value && fieldName.includes(key.toLowerCase())) {
          try {
            const text = String(value);
            const fontSize = 12;
            const widgets = field.acroField.getWidgets();
            for (const widget of widgets) {
              try {
                const rect = widget.getRectangle();
                // Определяем индекс страницы через /P в виджете
                let pageIdx = 0;
                try {
                  const pageRef = widget.dict.get(PDFName.of('P'));
                  if (pageRef) {
                    const found = pageRefMap.get(pageRef.toString());
                    if (found !== undefined) pageIdx = found;
                  }
                } catch (_) {}
                const page = pages[pageIdx] || pages[0];
                // Вертикальное выравнивание текста по центру поля
                const y = rect.y + (rect.height - fontSize) / 2;
                page.drawText(text, { x: rect.x + 2, y, size: fontSize, font: cyrFont });
                filledCount++;
              } catch (_) {}
            }
          } catch (e) {}
          break;
        }
      }
    });

    // Физически удаляем Widget-аннотации из массива Annots каждой страницы
    for (const page of pages) {
      try {
        const annotsRef = page.node.get(PDFName.of('Annots'));
        if (!annotsRef) continue;
        const annots = annotsRef instanceof PDFArray
          ? annotsRef
          : pdfDoc.context.lookup(annotsRef);
        if (!(annots instanceof PDFArray)) continue;

        const keepIndices = [];
        for (let i = 0; i < annots.size(); i++) {
          try {
            const annotRef = annots.get(i);
            const annot = pdfDoc.context.lookup(annotRef);
            if (!annot) continue;
            const subtype = annot.get(PDFName.of('Subtype'));
            if (!subtype || subtype.encodedName !== '/Widget') {
              keepIndices.push(i);
            }
          } catch (_) {
            keepIndices.push(i);
          }
        }

        if (keepIndices.length === 0) {
          page.node.delete(PDFName.of('Annots'));
        } else {
          const newAnnots = pdfDoc.context.obj([]);
          for (const idx of keepIndices) {
            newAnnots.push(annots.get(idx));
          }
          page.node.set(PDFName.of('Annots'), newAnnots);
        }
      } catch (_) {}
    }

    // Удаляем AcroForm из корня документа — PDF-просмотрщик не будет рендерить поля формы
    try { pdfDoc.catalog.delete(PDFName.of('AcroForm')); } catch (_) {}

    const modifiedPdfBytes = await pdfDoc.save();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `${driver.lastName}_${driver.firstName}_${timestamp}.pdf`;
    const filePath = path.join(__dirname, 'generated', fileName);
    fs.writeFileSync(filePath, modifiedPdfBytes);
    return { success: true, filePath, fileName, fieldsFound: fields.length, fieldsFilled: filledCount, fieldNames: fields.map(f => f.getName()) };
  } catch (error) {
    console.error('Ошибка генерации путевого листа:', error);
    return { success: false, error: error.message };
  }
});

// Получить координатный маппинг для шаблона
ipcMain.handle('get-field-mapping', async (_event, templateName) => {
  const mappingPath = path.join(dataPath, 'templates', templateName + '.mapping.json');
  if (fs.existsSync(mappingPath)) {
    return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  }
  return { fields: [] };
});

// Сохранить координатный маппинг для шаблона
ipcMain.handle('save-field-mapping', async (_event, templateName, mapping) => {
  try {
    const mappingPath = path.join(dataPath, 'templates', templateName + '.mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});