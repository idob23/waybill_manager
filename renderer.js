// renderer.js - Логика приложения (Renderer процесс)
// Используем безопасный API из preload.js через window.electronAPI

// api — псевдоним для electronAPI из preload.js (contextBridge)
// Нельзя использовать имя "electronAPI" — оно уже занято contextBridge как глобальная переменная
const api = window['electronAPI'];

// Глобальные переменные
let drivers = []; // Массив всех водителей
let currentDriver = null; // Текущий выбранный водитель
let editingDriverIndex = -1; // Индекс редактируемого водителя (-1 = добавление нового)
let selectedDriverIds = new Set(); // ID водителей для пакетной генерации
let vehicles = []; // Массив транспортных средств
let batchDriversData = {}; // Индивидуальные параметры каждого водителя в пакетной генерации
let activeBatchDriverId = null; // Текущая активная вкладка в пакетном модале
let printerModalCallback = null; // Callback после выбора принтера
let selectedPrinterName = null; // Выбранный принтер
let currentMaintenanceVehicleId = null; // ID техники для журнала обслуживания
let maintenanceRecords = []; // Записи журнала обслуживания
let mechanics = []; // Массив слесарей
let lastFocusedWorkersTextarea = null; // Последний активный textarea "Работники"

// Сегодняшняя дата по UTC+10 (Якутия)
function getTodayDate() {
    const now = new Date();
    const utc10 = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    return utc10.toISOString().split('T')[0];
}

// ===== TOAST И CONFIRM (неблокирующие замены alert/confirm) =====

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('confirmDialog');
        document.getElementById('confirmMessage').textContent = message;
        dialog.style.display = 'flex';
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        function cleanup(result) {
            dialog.style.display = 'none';
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

// Получение элементов DOM
const elements = {
    // Экраны
    welcomeScreen: document.getElementById('welcomeScreen'),
    driverDetailScreen: document.getElementById('driverDetailScreen'),
    driverFormScreen: document.getElementById('driverFormScreen'),
    
    // Список водителей
    driversList: document.getElementById('driversList'),
    searchInput: document.getElementById('searchInput'),
    
    // Кнопки управления
    addDriverBtn: document.getElementById('addDriverBtn'),
    backToWelcomeBtn: document.getElementById('backToWelcomeBtn'),
    editDriverBtn: document.getElementById('editDriverBtn'),
    deleteDriverBtn: document.getElementById('deleteDriverBtn'),
    cancelFormBtn: document.getElementById('cancelFormBtn'),
    cancelFormBtn2: document.getElementById('cancelFormBtn2'),
    
    // Форма водителя
    driverForm: document.getElementById('driverForm'),
    formTitle: document.getElementById('formTitle'),
    
    // Поля формы
    lastName: document.getElementById('lastName'),
    firstName: document.getElementById('firstName'),
    middleName: document.getElementById('middleName'),
    licenseSerial: document.getElementById('licenseSerial'),
    licenseNumber: document.getElementById('licenseNumber'),
    licenseDate: document.getElementById('licenseDate'),
    snils: document.getElementById('snils'),

    // Детали водителя
    driverName: document.getElementById('driverName'),
    detailFullName: document.getElementById('detailFullName'),
    detailLicense: document.getElementById('detailLicense'),
    detailLicenseDate: document.getElementById('detailLicenseDate'),
    detailSnils: document.getElementById('detailSnils'),
    
    // Шаблоны и путевые листы
    uploadTemplateBtn: document.getElementById('uploadTemplateBtn'),
    templatesList: document.getElementById('templatesList'),
    templateSelect: document.getElementById('templateSelect'),
    generateWaybillBtn: document.getElementById('generateWaybillBtn'),
    openFolderBtn: document.getElementById('openFolderBtn'),
    openFolderBtnWelcome: document.getElementById('openFolderBtnWelcome'),

    // Пакетная генерация
    batchPanel: document.getElementById('batchPanel'),
    batchCountLabel: document.getElementById('batchCountLabel'),
    batchModal: document.getElementById('batchModal'),
    batchWaybillForm: document.getElementById('batchWaybillForm'),
    batchTemplateSelect: document.getElementById('batchTemplateSelect'),
    batchDriverTabs: document.getElementById('batchDriverTabs'),

    // Модальное окно
    waybillModal: document.getElementById('waybillModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    waybillDataForm: document.getElementById('waybillDataForm'),

    // Список техники
    vehiclesBtn: document.getElementById('vehiclesBtn'),
    vehiclesModal: document.getElementById('vehiclesModal'),
    vehiclesList: document.getElementById('vehiclesList'),
    vehicleSelect: document.getElementById('vehicleSelect'),
    batchVehicleSelect: document.getElementById('batchVehicleSelect'),

    // Журнал обслуживания
    vehicleMaintenanceModal: document.getElementById('vehicleMaintenanceModal'),
    maintenanceModalTitle: document.getElementById('maintenanceModalTitle'),
    maintenanceTableBody: document.getElementById('maintenanceTableBody'),

    // Попап слесарей
    mechanicsPopup: document.getElementById('mechanicsPopup'),
    mechanicsDriversList: document.getElementById('mechanicsDriversList'),
    mechanicsList: document.getElementById('mechanicsList'),

    // Поля модального окна
    waybillDateFrom: document.getElementById('waybillDateFrom'),
    waybillDateTo: document.getElementById('waybillDateTo'),
    waybillNumber: document.getElementById('waybillNumber'),
    vehicleModel: document.getElementById('vehicleModel'),
    vehicleNumber: document.getElementById('vehicleNumber'),
    departurePoint: document.getElementById('departurePoint'),
    destination: document.getElementById('destination'),
    departureTime: document.getElementById('departureTime'),
    returnTime: document.getElementById('returnTime'),
    odometerStart: document.getElementById('odometerStart'),
    odometerEnd: document.getElementById('odometerEnd'),
    route: document.getElementById('route'),

    // Редактор маппинга
    templateEditorScreen: document.getElementById('templateEditorScreen'),
    editorBackBtn: document.getElementById('editorBackBtn'),
    editorTemplateName: document.getElementById('editorTemplateName'),
    saveFieldMappingBtn: document.getElementById('saveFieldMappingBtn'),
    fieldTypeSelect: document.getElementById('fieldTypeSelect'),
    editorFontSize: document.getElementById('editorFontSize'),
    placedFieldsList: document.getElementById('placedFieldsList'),
    fieldsCount: document.getElementById('fieldsCount'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    canvasWrapper: document.getElementById('canvasWrapper')
};

// Инициализация приложения
async function init() {
    console.log('Инициализация приложения...');

    // Сначала регистрируем обработчики — кнопки должны работать сразу
    setupEventListeners();
    showScreen('welcome');

    // Потом загружаем данные асинхронно
    await loadDrivers();
    await loadTemplates();
    await loadVehicles();
    renderDriversList();
}

// ===== СПИСОК ТЕХНИКИ =====

async function loadVehicles() {
    try {
        vehicles = await api.getVehicles();
    } catch (err) {
        console.error('Ошибка загрузки техники:', err);
        vehicles = [];
    }
}

function populateVehicleSelects() {
    const options = vehicles.map(v =>
        `<option value="${v.id}">${v.model} — ${v.number}</option>`
    ).join('');
    const placeholder = '<option value="">— или выбрать из списка техники —</option>';
    elements.vehicleSelect.innerHTML = placeholder + options;
    elements.batchVehicleSelect.innerHTML = placeholder + options;
}

function openVehiclesModal() {
    document.getElementById('vehicleSearchInput').value = '';
    renderVehiclesList();
    elements.vehiclesModal.style.display = 'flex';
    setTimeout(() => document.getElementById('vehicleSearchInput').focus(), 50);
}

function closeVehiclesModal() {
    elements.vehiclesModal.style.display = 'none';
}

function renderVehiclesList(filter = '') {
    if (vehicles.length === 0) {
        elements.vehiclesList.innerHTML = '<p class="vehicles-empty">Список техники пуст. Добавьте транспортное средство.</p>';
        return;
    }
    const f = filter.toLowerCase();
    const filtered = f ? vehicles.filter(v => v.model.toLowerCase().includes(f) || v.number.toLowerCase().includes(f)) : vehicles;
    if (filtered.length === 0) {
        elements.vehiclesList.innerHTML = '<p class="vehicles-empty">Ничего не найдено</p>';
        return;
    }
    elements.vehiclesList.innerHTML = filtered.map(v => `
        <div class="vehicle-item" data-id="${v.id}">
            <div class="vehicle-info">
                <span class="vehicle-model">${v.model}</span>
                <span class="vehicle-number">${v.number}</span>
            </div>
            <div class="vehicle-actions">
                <button class="btn-edit-vehicle" data-id="${v.id}" title="Редактировать">✏️</button>
                <button class="btn-delete-vehicle" data-id="${v.id}" title="Удалить">🗑</button>
            </div>
        </div>
    `).join('');
}

async function addVehicle() {
    const modelInput = document.getElementById('newVehicleModel');
    const numberInput = document.getElementById('newVehicleNumber');
    const model = modelInput.value.trim();
    const number = numberInput.value.trim();
    if (!model && !number) return;
    const newVehicle = { id: Date.now(), model, number };
    vehicles.push(newVehicle);
    await api.saveVehicles(vehicles);
    modelInput.value = '';
    numberInput.value = '';
    renderVehiclesList();
    modelInput.focus();
}

function editVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    const item = elements.vehiclesList.querySelector(`.btn-edit-vehicle[data-id="${id}"]`).closest('.vehicle-item');
    item.className = 'vehicle-edit-form';
    item.innerHTML = `
        <input type="text" class="form-control" value="${vehicle.model}" data-field="model">
        <input type="text" class="form-control" value="${vehicle.number}" data-field="number">
        <button class="btn-save-vehicle" data-id="${id}" title="Сохранить">✅</button>
        <button class="btn-cancel-vehicle" title="Отменить">❌</button>
    `;
    item.querySelector('[data-field="model"]').focus();
}

async function saveVehicleEdit(id, form) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    vehicle.model = form.querySelector('[data-field="model"]').value.trim();
    vehicle.number = form.querySelector('[data-field="number"]').value.trim();
    await api.saveVehicles(vehicles);
    populateVehicleSelects();
    renderVehiclesList(document.getElementById('vehicleSearchInput').value);
}

async function deleteVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    const confirmed = await showConfirm(`Удалить технику ${vehicle.model} ${vehicle.number}?`);
    if (!confirmed) return;
    vehicles = vehicles.filter(v => v.id !== id);
    await api.saveVehicles(vehicles);
    renderVehiclesList(document.getElementById('vehicleSearchInput').value);
}

// ===== ЖУРНАЛ ОБСЛУЖИВАНИЯ =====

async function openMaintenanceModal(vehicleId) {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    currentMaintenanceVehicleId = vehicleId;
    elements.maintenanceModalTitle.textContent = `🔧 Журнал обслуживания: ${vehicle.model} — ${vehicle.number}`;
    try {
        maintenanceRecords = await api.getVehicleMaintenance(vehicleId);
    } catch (err) {
        console.error('Ошибка загрузки журнала:', err);
        maintenanceRecords = [];
    }
    renderMaintenanceTable();
    elements.vehicleMaintenanceModal.style.display = 'flex';
}

function closeMaintenanceModal() {
    elements.vehicleMaintenanceModal.style.display = 'none';
    currentMaintenanceVehicleId = null;
    maintenanceRecords = [];
    lastFocusedWorkersTextarea = null;
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 32) + 'px';
}

function formatFIO(person) {
    const last = person.lastName || '';
    const first = person.firstName ? person.firstName[0] + '.' : '';
    const middle = person.middleName ? person.middleName[0] + '.' : '';
    return `${last} ${first}${middle}`.trim();
}

async function showWorkersDropdown(textarea) {
    if (mechanics.length === 0) {
        try { mechanics = await api.getMechanics(); } catch (err) { mechanics = []; }
    }
    let html = '<div class="worker-group-title">Водители</div>';
    if (drivers.length > 0) {
        drivers.forEach(d => { html += `<div class="worker-option">${formatFIO(d)}</div>`; });
    } else {
        html += '<div style="padding:6px 10px;color:#95a5a6;font-size:12px;">Нет водителей</div>';
    }
    html += '<div class="worker-group-title">Слесари</div>';
    if (mechanics.length > 0) {
        mechanics.forEach(m => { html += `<div class="worker-option">${formatFIO(m)}</div>`; });
    } else {
        html += '<div style="padding:6px 10px;color:#95a5a6;font-size:12px;">Нет слесарей. Добавьте через «Все водители и слесари»</div>';
    }
    const dropdown = document.createElement('div');
    dropdown.className = 'workers-dropdown';
    dropdown.innerHTML = html;

    const rect = textarea.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = rect.bottom + 'px';
    dropdown.style.width = Math.max(rect.width, 220) + 'px';
    document.body.appendChild(dropdown);

    const removeDropdown = () => dropdown.remove();

    dropdown.addEventListener('click', (e) => {
        const opt = e.target.closest('.worker-option');
        if (!opt) return;
        const fio = opt.textContent;
        const current = textarea.value.trim();
        textarea.value = current ? current + ', ' + fio : fio;
        autoResizeTextarea(textarea);
        removeDropdown();
    });

    const wrapper = document.querySelector('.maintenance-table-wrapper');
    if (wrapper) wrapper.addEventListener('scroll', removeDropdown, { once: true });

    setTimeout(() => {
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== textarea) removeDropdown();
        }, { once: true });
    }, 0);
}

function renderMaintenanceTable() {
    if (maintenanceRecords.length === 0) {
        elements.maintenanceTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#95a5a6;padding:20px;">Нет записей. Нажмите "Добавить запись".</td></tr>';
        return;
    }
    elements.maintenanceTableBody.innerHTML = maintenanceRecords.map((r, i) => `
        <tr class="maintenance-row${r.completed ? ' maintenance-completed' : ''}" data-index="${i}">
            <td><input type="date" class="m-input m-date" value="${r.date || ''}"></td>
            <td><input type="text" class="m-input m-odometer" value="${r.odometer || ''}" placeholder="км / м.ч."></td>
            <td><textarea class="m-input m-work-type" rows="1">${r.workType || ''}</textarea></td>
            <td class="m-workers-cell"><textarea class="m-input m-workers" rows="1" placeholder="Нажмите для выбора...">${r.workers || ''}</textarea></td>
            <td><textarea class="m-input m-parts" rows="1">${r.parts || ''}</textarea></td>
            <td><textarea class="m-input m-fluids" rows="1">${r.fluids || ''}</textarea></td>
            <td style="text-align:center"><input type="checkbox" class="m-completed" ${r.completed ? 'checked' : ''}></td>
            <td><textarea class="m-input m-note" rows="1">${r.note || ''}</textarea></td>
            <td><button class="btn-delete-maintenance" data-index="${i}" title="Удалить">🗑</button></td>
        </tr>
    `).join('');
    elements.maintenanceTableBody.querySelectorAll('textarea.m-input').forEach(ta => {
        if (ta.value.length > 0) autoResizeTextarea(ta);
    });
}

function collectMaintenanceFromDOM() {
    const rows = elements.maintenanceTableBody.querySelectorAll('.maintenance-row');
    maintenanceRecords = Array.from(rows).map(row => ({
        date: row.querySelector('.m-date').value,
        odometer: row.querySelector('.m-odometer').value,
        workType: row.querySelector('.m-work-type').value,
        workers: row.querySelector('.m-workers').value,
        parts: row.querySelector('.m-parts').value,
        fluids: row.querySelector('.m-fluids').value,
        completed: row.querySelector('.m-completed').checked,
        note: row.querySelector('.m-note').value
    }));
}

function addMaintenanceRow() {
    collectMaintenanceFromDOM();
    maintenanceRecords.push({
        date: getTodayDate(), odometer: '', workType: '', workers: '',
        parts: '', fluids: '', completed: false, note: ''
    });
    renderMaintenanceTable();
    const wrapper = document.querySelector('.maintenance-table-wrapper');
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
}

async function deleteMaintenanceRow(index) {
    const confirmed = await showConfirm('Удалить эту запись?');
    if (!confirmed) return;
    collectMaintenanceFromDOM();
    maintenanceRecords.splice(index, 1);
    renderMaintenanceTable();
}

async function saveMaintenanceRecords() {
    if (!currentMaintenanceVehicleId) return;
    collectMaintenanceFromDOM();
    try {
        const result = await api.saveVehicleMaintenance(currentMaintenanceVehicleId, maintenanceRecords);
        if (result.success) {
            showToast('Журнал обслуживания сохранён');
        } else {
            showToast('Ошибка сохранения', 'error', 5000);
        }
    } catch (err) {
        showToast('Ошибка сохранения: ' + err.message, 'error', 5000);
    }
}

// ===== ПЕЧАТЬ ЖУРНАЛА =====

async function printMaintenanceJournal() {
    const dateFrom = document.getElementById('maintenancePrintDateFrom').value;
    const dateTo = document.getElementById('maintenancePrintDateTo').value;

    const filtered = maintenanceRecords.filter(r => {
        if (!r.date) return !dateFrom && !dateTo;
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        return true;
    });

    if (filtered.length === 0) {
        showToast('Нет записей за выбранный период', 'info');
        return;
    }

    document.getElementById('maintenancePrintModal').style.display = 'none';

    const vehicle = vehicles.find(v => v.id === currentMaintenanceVehicleId);
    if (!vehicle) return;

    openPrinterSelectModal(async (printerName) => {
        try {
            const pdfResult = await api.generateMaintenancePdf({
                vehicle: { model: vehicle.model, number: vehicle.number },
                records: filtered,
                dateFrom,
                dateTo
            });
            if (!pdfResult.success) {
                showToast('Ошибка генерации PDF: ' + pdfResult.error, 'error', 5000);
                return;
            }
            const printResult = await api.printFile(pdfResult.filePath, printerName);
            if (printResult.success) {
                showToast('Журнал отправлен на печать');
            } else {
                showToast('Ошибка печати: ' + printResult.failureReason, 'error', 5000);
            }
        } catch (err) {
            showToast('Ошибка: ' + err.message, 'error', 5000);
        }
    });
}

async function saveMaintenancePdf() {
    collectMaintenanceFromDOM();
    if (maintenanceRecords.length === 0) {
        showToast('Нет записей для сохранения', 'info');
        return;
    }

    const vehicle = vehicles.find(v => v.id === currentMaintenanceVehicleId);
    if (!vehicle) return;

    try {
        const result = await api.saveMaintenancePdf({
            vehicle: { model: vehicle.model, number: vehicle.number },
            records: maintenanceRecords,
            dateFrom: '',
            dateTo: ''
        });
        if (result.success) {
            showToast(`PDF сохранён: ${result.fileName}`, 'success');
        } else {
            showToast('Ошибка сохранения: ' + result.error, 'error', 5000);
        }
    } catch (err) {
        showToast('Ошибка: ' + err.message, 'error', 5000);
    }
}

// ===== ПОПАП СЛЕСАРЕЙ =====

async function openMechanicsPopup() {
    elements.mechanicsDriversList.innerHTML = drivers.map(d => {
        const fio = `${d.lastName} ${d.firstName} ${d.middleName || ''}`.trim();
        return `<div class="mechanics-name-item" data-fio="${fio}">${fio}</div>`;
    }).join('') || '<p style="color:#95a5a6">Нет водителей</p>';

    try {
        mechanics = await api.getMechanics();
    } catch (err) {
        mechanics = [];
    }
    renderMechanicsList();
    elements.mechanicsPopup.style.display = 'flex';
}

function closeMechanicsPopup() {
    elements.mechanicsPopup.style.display = 'none';
}

function renderMechanicsList() {
    elements.mechanicsList.innerHTML = mechanics.map((m, i) => {
        const fio = `${m.lastName} ${m.firstName} ${m.middleName || ''}`.trim();
        return `<div class="mechanics-name-item" data-fio="${fio}">
            <span>${fio}</span>
            <button class="btn-delete-mechanic" data-index="${i}" title="Удалить">🗑</button>
        </div>`;
    }).join('') || '<p style="color:#95a5a6">Нет слесарей</p>';
}

async function addMechanic() {
    const lastNameEl = document.getElementById('newMechanicLastName');
    const firstNameEl = document.getElementById('newMechanicFirstName');
    const middleNameEl = document.getElementById('newMechanicMiddleName');
    const lastName = lastNameEl.value.trim();
    const firstName = firstNameEl.value.trim();
    const middleName = middleNameEl.value.trim();
    if (!lastName && !firstName) return;
    mechanics.push({ id: Date.now(), lastName, firstName, middleName });
    await api.saveMechanics(mechanics);
    lastNameEl.value = '';
    firstNameEl.value = '';
    middleNameEl.value = '';
    renderMechanicsList();
    lastNameEl.focus();
}

async function deleteMechanic(index) {
    mechanics.splice(index, 1);
    await api.saveMechanics(mechanics);
    renderMechanicsList();
}

function insertWorkerName(fio) {
    if (lastFocusedWorkersTextarea) {
        const ta = lastFocusedWorkersTextarea;
        const current = ta.value.trim();
        ta.value = current ? current + ', ' + fio : fio;
        ta.focus();
        showToast(`Добавлено: ${fio}`, 'info', 1500);
    } else {
        navigator.clipboard.writeText(fio);
        showToast(`Скопировано: ${fio}`, 'info', 1500);
    }
}

// ===== ПРИНТЕР =====

async function openPrinterSelectModal(callback) {
    printerModalCallback = callback;
    selectedPrinterName = null;

    const list = document.getElementById('printersList');
    list.innerHTML = '<p class="printers-loading">Загрузка принтеров...</p>';
    document.getElementById('confirmPrintBtn').disabled = true;
    document.getElementById('printerModal').style.display = 'flex';

    try {
        const printers = await api.getPrinters();
        if (printers.length === 0) {
            list.innerHTML = '<p class="printers-empty">Принтеры не найдены</p>';
            return;
        }
        list.innerHTML = printers.map(p => `
            <div class="printer-item${p.isDefault ? ' is-default' : ''}" data-name="${p.name}">
                <span class="printer-icon">🖨</span>
                <div class="printer-info">
                    <span class="printer-name">${p.displayName}</span>
                    ${p.isDefault ? '<span class="printer-default-badge">По умолчанию</span>' : ''}
                </div>
            </div>
        `).join('');

        // Автовыбор принтера по умолчанию
        const def = printers.find(p => p.isDefault);
        if (def) selectPrinter(def.name);
    } catch (err) {
        list.innerHTML = `<p class="printers-empty">Ошибка загрузки принтеров: ${err.message}</p>`;
    }
}

function selectPrinter(name) {
    selectedPrinterName = name;
    document.querySelectorAll('.printer-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.name === name);
    });
    document.getElementById('confirmPrintBtn').disabled = false;
}

function closePrinterSelectModal() {
    document.getElementById('printerModal').style.display = 'none';
    printerModalCallback = null;
    selectedPrinterName = null;
}

// Сгенерировать одну путёвку + отправить на печать
function generateAndPrint() {
    const templateName = elements.templateSelect.value;
    if (!templateName) { showToast('Выберите шаблон путевого листа', 'info'); return; }
    if (!currentDriver) { showToast('Водитель не выбран', 'info'); return; }

    const waybillData = {
        date: formatDateRange(elements.waybillDateFrom.value, elements.waybillDateTo.value),
        number: elements.waybillNumber.value,
        vehicleModel: elements.vehicleModel.value.trim(),
        vehicleNumber: elements.vehicleNumber.value.trim(),
        departurePoint: elements.departurePoint.value.trim(),
        destination: elements.destination.value.trim(),
        departureTime: elements.departureTime.value,
        returnTime: elements.returnTime.value,
        odometerStart: elements.odometerStart.value,
        odometerEnd: elements.odometerEnd.value,
        route: elements.route.value.trim()
    };

    openPrinterSelectModal(async (printerName) => {
        currentDriver.waybillTemplate = {
            vehicleModel: waybillData.vehicleModel,
            vehicleNumber: waybillData.vehicleNumber,
            departurePoint: waybillData.departurePoint,
            destination: waybillData.destination,
            route: waybillData.route
        };
        const idx = drivers.findIndex(d => d.id === currentDriver.id);
        if (idx !== -1) { drivers[idx] = currentDriver; await saveDrivers(); }

        closeWaybillModal();

        try {
            const result = await api.generateWaybill(templateName, currentDriver, waybillData);
            if (!result.success) throw new Error(result.error);
            const printResult = await api.printFile(result.filePath, printerName);
            if (printResult.success) {
                showToast(`Путевой лист создан и отправлен на печать!\nФайл: ${result.fileName}`);
            } else {
                showToast(`Путевой лист создан, но ошибка печати: ${printResult.failureReason}\nФайл: ${result.fileName}`, 'error', 5000);
            }
            await api.openGeneratedFolder();
        } catch (error) {
            showToast('Ошибка: ' + error.message, 'error', 5000);
        }
    });
}

// Пакетная генерация + печать
async function generateBatchAndPrint() {
    saveBatchDriverForm();

    const templateName = elements.batchTemplateSelect.value;
    if (!templateName) { showToast('Выберите шаблон', 'info'); return; }

    const selectedDrivers = drivers.filter(d => selectedDriverIds.has(d.id));
    if (selectedDrivers.length === 0) return;

    const driversSnapshot = { ...batchDriversData };

    openPrinterSelectModal(async (printerName) => {
        closeBatchModal();

        let successCount = 0;
        const errors = [];
        const filePaths = [];

        for (const driver of selectedDrivers) {
            const data = driversSnapshot[driver.id] || {};
            const waybillData = {
                date:           formatDateRange(data.dateFrom, data.dateTo),
                number:         data.number || '',
                vehicleModel:   data.vehicleModel || '',
                vehicleNumber:  data.vehicleNumber || '',
                departurePoint: data.departurePoint || '',
                destination:    data.destination || '',
                departureTime:  data.departureTime || '',
                returnTime:     data.returnTime || '',
                route:          data.route || ''
            };
            try {
                const result = await api.generateWaybill(templateName, driver, waybillData);
                if (result.success) { successCount++; filePaths.push(result.filePath); }
                else errors.push(`${driver.lastName} ${driver.firstName}: ${result.error}`);
            } catch (err) {
                errors.push(`${driver.lastName} ${driver.firstName}: ${err.message}`);
            }
        }

        for (const fp of filePaths) {
            await api.printFile(fp, printerName);
        }

        selectedDriverIds.clear();
        renderDriversList();

        let msg = `Готово!\nСоздано путёвок: ${successCount} из ${selectedDrivers.length}\nОтправлено на печать: ${filePaths.length}`;
        if (errors.length > 0) msg += `\n\nОшибки:\n` + errors.join('\n');
        showToast(msg, errors.length > 0 ? 'error' : 'success', 5000);

        if (successCount > 0) await api.openGeneratedFolder();
    });
}

// Загрузить водителей из файла
async function loadDrivers() {
    try {
        drivers = await api.getDrivers();
        console.log('Загружено водителей:', drivers.length);
    } catch (error) {
        console.error('Ошибка загрузки водителей:', error);
        showToast('Ошибка загрузки данных водителей', 'error', 5000);
    }
}

// Сохранить водителей в файл
async function saveDrivers() {
    try {
        const result = await api.saveDrivers(drivers);
        if (!result.success) {
            throw new Error(result.error);
        }
        console.log('Водители сохранены успешно');
    } catch (error) {
        console.error('Ошибка сохранения водителей:', error);
        showToast('Ошибка сохранения данных', 'error', 5000);
    }
}

// Загрузить список шаблонов
async function loadTemplates() {
    try {
        const templates = await api.getTemplates();
        console.log('Загружено шаблонов:', templates.length);

        // Обновляем список шаблонов на экране приветствия
        renderTemplatesList(templates);

        // Обновляем select для выбора шаблона
        updateTemplateSelect(templates);

    } catch (error) {
        console.error('Ошибка загрузки шаблонов:', error);
    }
}

// Показать определенный экран
function showScreen(screenName) {
    elements.welcomeScreen.style.display = 'none';
    elements.driverDetailScreen.style.display = 'none';
    elements.driverFormScreen.style.display = 'none';
    elements.templateEditorScreen.style.display = 'none';

    switch(screenName) {
        case 'welcome':
            elements.welcomeScreen.style.display = 'block';
            break;
        case 'detail':
            elements.driverDetailScreen.style.display = 'block';
            break;
        case 'form':
            elements.driverFormScreen.style.display = 'block';
            break;
        case 'editor':
            elements.templateEditorScreen.style.display = 'flex';
            break;
    }
}

// Отрисовать список водителей
function renderDriversList(filter = '') {
    elements.driversList.innerHTML = '';
    
    const filteredDrivers = drivers.filter(driver => {
        const fullName = `${driver.lastName} ${driver.firstName} ${driver.middleName || ''}`.toLowerCase();
        return fullName.includes(filter.toLowerCase());
    });
    
    if (filteredDrivers.length === 0) {
        elements.driversList.innerHTML = '<div class="empty-state"><p>Водители не найдены</p></div>';
        return;
    }
    
    filteredDrivers.forEach((driver) => {
        const driverItem = document.createElement('div');
        driverItem.className = 'driver-item';
        if (currentDriver && currentDriver.id === driver.id) driverItem.classList.add('active');
        if (selectedDriverIds.has(driver.id)) driverItem.classList.add('batch-selected');

        const licenseStr = [driver.licenseSerial, driver.licenseNumber].filter(Boolean).join(' ') || driver.license || '—';
        driverItem.innerHTML = `
            <div class="driver-item-header">
                <input type="checkbox" class="driver-checkbox" data-id="${driver.id}" ${selectedDriverIds.has(driver.id) ? 'checked' : ''}>
                <div class="driver-item-info">
                    <h3>${driver.lastName} ${driver.firstName}</h3>
                    <p>📄 В/У: ${licenseStr}</p>
                    <p>🪪 СНИЛС: ${driver.snils || '—'}</p>
                </div>
            </div>
        `;

        // Чекбокс — переключает выборку без открытия карточки
        const checkbox = driverItem.querySelector('.driver-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleDriverSelection(driver.id, checkbox.checked);
        });

        // Клик по карточке — открыть детали (не по чекбоксу)
        driverItem.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            selectDriver(driver);
        });

        elements.driversList.appendChild(driverItem);
    });

    updateBatchPanel();
}

// ===== ПАКЕТНАЯ ГЕНЕРАЦИЯ =====

function toggleDriverSelection(driverId, checked) {
    if (checked) selectedDriverIds.add(driverId);
    else selectedDriverIds.delete(driverId);

    // Обновить визуал только этой карточки
    const checkbox = elements.driversList.querySelector(`[data-id="${driverId}"]`);
    if (checkbox) checkbox.closest('.driver-item').classList.toggle('batch-selected', checked);

    updateBatchPanel();
}

function updateBatchPanel() {
    const count = selectedDriverIds.size;
    elements.batchPanel.style.display = count > 0 ? 'flex' : 'none';
    elements.batchCountLabel.textContent = `Выбрано: ${count}`;
}

function openBatchModal() {
    if (selectedDriverIds.size === 0) return;

    const selectedDrivers = drivers.filter(d => selectedDriverIds.has(d.id));
    const today = getTodayDate();

    // Инициализируем индивидуальные данные для каждого водителя
    batchDriversData = {};
    selectedDrivers.forEach(d => {
        batchDriversData[d.id] = {
            dateFrom: today, dateTo: today, number: '',
            vehicleModel: '', vehicleNumber: '',
            departurePoint: '', destination: '',
            departureTime: '', returnTime: '', route: ''
        };
    });
    activeBatchDriverId = selectedDrivers[0].id;

    elements.batchTemplateSelect.innerHTML = elements.templateSelect.innerHTML;
    populateVehicleSelects();

    renderBatchDriverTabs(selectedDrivers);
    loadBatchDriverForm(activeBatchDriverId);

    elements.batchModal.style.display = 'flex';
    setTimeout(() => document.getElementById('batchNumberStart').focus(), 50);
}

function renderBatchDriverTabs(selectedDrivers) {
    elements.batchDriverTabs.innerHTML = selectedDrivers.map(d => {
        const label = `${d.lastName} ${d.firstName}${d.middleName ? ' ' + d.middleName[0] + '.' : ''}`;
        const active = d.id === activeBatchDriverId ? ' active' : '';
        return `<button type="button" class="batch-driver-tab${active}" data-id="${d.id}">${label}</button>`;
    }).join('');
}

function saveBatchDriverForm() {
    if (!activeBatchDriverId) return;
    batchDriversData[activeBatchDriverId] = {
        dateFrom:       document.getElementById('batchDateFrom').value,
        dateTo:         document.getElementById('batchDateTo').value,
        number:         document.getElementById('batchNumberStart').value,
        vehicleModel:   document.getElementById('batchVehicleModel').value.trim(),
        vehicleNumber:  document.getElementById('batchVehicleNumber').value.trim(),
        departurePoint: document.getElementById('batchDeparturePoint').value.trim(),
        destination:    document.getElementById('batchDestination').value.trim(),
        departureTime:  document.getElementById('batchDepartureTime').value,
        returnTime:     document.getElementById('batchReturnTime').value,
        route:          document.getElementById('batchRoute').value.trim()
    };
}

function loadBatchDriverForm(driverId) {
    const data = batchDriversData[driverId];
    if (!data) return;
    document.getElementById('batchDateFrom').value    = data.dateFrom;
    document.getElementById('batchDateTo').value      = data.dateTo;
    document.getElementById('batchNumberStart').value = data.number;
    document.getElementById('batchVehicleModel').value   = data.vehicleModel;
    document.getElementById('batchVehicleNumber').value  = data.vehicleNumber;
    document.getElementById('batchDeparturePoint').value = data.departurePoint;
    document.getElementById('batchDestination').value    = data.destination;
    document.getElementById('batchDepartureTime').value  = data.departureTime;
    document.getElementById('batchReturnTime').value     = data.returnTime;
    document.getElementById('batchRoute').value          = data.route;
    elements.batchVehicleSelect.value = '';
}

function switchBatchDriver(driverId) {
    if (driverId === activeBatchDriverId) return;
    saveBatchDriverForm();
    activeBatchDriverId = driverId;
    elements.batchDriverTabs.querySelectorAll('.batch-driver-tab').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.id) === driverId);
    });
    loadBatchDriverForm(driverId);
}

function closeBatchModal() {
    elements.batchModal.style.display = 'none';
    batchDriversData = {};
    activeBatchDriverId = null;
}

async function generateBatchWaybills(e) {
    e.preventDefault();

    saveBatchDriverForm(); // сохраняем текущую вкладку

    const templateName = elements.batchTemplateSelect.value;
    if (!templateName) { showToast('Выберите шаблон', 'info'); return; }

    const selectedDrivers = drivers.filter(d => selectedDriverIds.has(d.id));
    if (selectedDrivers.length === 0) return;

    // Сохраняем снимок данных ДО закрытия модала (closeBatchModal сбрасывает batchDriversData)
    const driversSnapshot = { ...batchDriversData };
    closeBatchModal();

    let successCount = 0;
    const errors = [];

    for (let i = 0; i < selectedDrivers.length; i++) {
        const driver = selectedDrivers[i];
        const data = driversSnapshot[driver.id] || {};
        const waybillData = {
            date:           formatDateRange(data.dateFrom, data.dateTo),
            number:         data.number || '',
            vehicleModel:   data.vehicleModel || '',
            vehicleNumber:  data.vehicleNumber || '',
            departurePoint: data.departurePoint || '',
            destination:    data.destination || '',
            departureTime:  data.departureTime || '',
            returnTime:     data.returnTime || '',
            route:          data.route || ''
        };
        try {
            const result = await api.generateWaybill(templateName, driver, waybillData);
            if (result.success) successCount++;
            else errors.push(`${driver.lastName} ${driver.firstName}: ${result.error}`);
        } catch (err) {
            errors.push(`${driver.lastName} ${driver.firstName}: ${err.message}`);
        }
    }

    // Сбрасываем выборку
    selectedDriverIds.clear();
    renderDriversList();

    let msg = `Готово!\nСоздано путёвок: ${successCount} из ${selectedDrivers.length}`;
    if (errors.length > 0) msg += `\n\nОшибки:\n` + errors.join('\n');
    showToast(msg, errors.length > 0 ? 'error' : 'success', 5000);

    if (successCount > 0) await api.openGeneratedFolder();
}

// Отрисовать список шаблонов
function renderTemplatesList(templates) {
    elements.templatesList.innerHTML = '';
    
    if (templates.length === 0) {
        elements.templatesList.innerHTML = '<p style="color: #7f8c8d; margin-top: 15px;">Шаблоны не загружены</p>';
        return;
    }
    
    templates.forEach(template => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.innerHTML = `
            <span>📄 ${template}</span>
            <div class="template-item-actions">
                <button class="btn-edit-fields">⚙️ Настроить поля</button>
                <button class="btn-delete-tpl">Удалить</button>
            </div>
        `;

        templateItem.querySelector('.btn-edit-fields').addEventListener('click', () => {
            openTemplateEditor(template);
        });

        templateItem.querySelector('.btn-delete-tpl').addEventListener('click', async () => {
            if (await showConfirm(`Удалить шаблон "${template}"?`)) {
                await deleteTemplate(template);
            }
        });

        elements.templatesList.appendChild(templateItem);
    });
}

// Обновить select со списком шаблонов
function updateTemplateSelect(templates) {
    elements.templateSelect.innerHTML = '<option value="">Выберите шаблон...</option>';
    
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template;
        option.textContent = template;
        elements.templateSelect.appendChild(option);
    });
}

// Выбрать водителя для просмотра
function selectDriver(driver) {
    currentDriver = driver;
    
    // Обновляем детали водителя
    const fullName = `${driver.lastName} ${driver.firstName} ${driver.middleName || ''}`.trim();
    const licenseStr = [driver.licenseSerial, driver.licenseNumber].filter(Boolean).join(' ') || driver.license || 'Не указано';
    elements.driverName.textContent = fullName;
    elements.detailFullName.textContent = fullName;
    elements.detailLicense.textContent = licenseStr;
    elements.detailLicenseDate.textContent = driver.licenseDate || 'Не указано';
    elements.detailSnils.textContent = driver.snils || 'Не указано';
    
    // Показываем экран деталей
    showScreen('detail');
    renderDriversList(); // Перерисовываем список для обновления активного элемента
}

// Добавить нового водителя
function addNewDriver() {
    editingDriverIndex = -1;
    elements.formTitle.textContent = 'Добавить водителя';
    clearForm();
    showScreen('form');
}

// Редактировать водителя
function editDriver() {
    if (!currentDriver) return;
    
    editingDriverIndex = drivers.findIndex(d => d.id === currentDriver.id);
    elements.formTitle.textContent = 'Редактировать водителя';
    
    // Заполняем форму данными водителя
    elements.lastName.value = currentDriver.lastName || '';
    elements.firstName.value = currentDriver.firstName || '';
    elements.middleName.value = currentDriver.middleName || '';
    elements.licenseSerial.value = currentDriver.licenseSerial || '';
    elements.licenseNumber.value = currentDriver.licenseNumber || '';
    elements.licenseDate.value = currentDriver.licenseDate || '';
    elements.snils.value = currentDriver.snils || '';
    
    showScreen('form');
}

// Удалить водителя
async function deleteDriver() {
    if (!currentDriver) return;
    
    const confirmed = await showConfirm(`Удалить водителя ${currentDriver.lastName} ${currentDriver.firstName}?`);
    if (!confirmed) return;
    
    drivers = drivers.filter(d => d.id !== currentDriver.id);
    await saveDrivers();
    
    currentDriver = null;
    renderDriversList();
    showScreen('welcome');
}

// Валидация полей формы
function validateDriverForm() {
    let isValid = true;
    const errors = [];

    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));

    const lastName = elements.lastName.value.trim();
    if (!lastName) {
        errors.push('Фамилия обязательна');
        elements.lastName.classList.add('error');
        isValid = false;
    }

    const firstName = elements.firstName.value.trim();
    if (!firstName) {
        errors.push('Имя обязательно');
        elements.firstName.classList.add('error');
        isValid = false;
    }

    const licenseSerial = elements.licenseSerial.value.trim();
    if (!licenseSerial) {
        errors.push('Серия ВУ обязательна');
        elements.licenseSerial.classList.add('error');
        isValid = false;
    }

    const licenseNumber = elements.licenseNumber.value.trim();
    if (!licenseNumber) {
        errors.push('Номер ВУ обязателен');
        elements.licenseNumber.classList.add('error');
        isValid = false;
    }

    if (!isValid) {
        showToast('Ошибки:\n' + errors.join('\n'), 'error', 5000);
    }
    return isValid;
}

// Сохранить водителя (добавление или редактирование)
async function saveDriver(e) {
    e.preventDefault();

    // Валидация формы
    if (!validateDriverForm()) {
        return;
    }

    // Собираем данные из формы
    const driverData = {
        lastName: elements.lastName.value.trim(),
        firstName: elements.firstName.value.trim(),
        middleName: elements.middleName.value.trim(),
        licenseSerial: elements.licenseSerial.value.trim(),
        licenseNumber: elements.licenseNumber.value.trim(),
        licenseDate: elements.licenseDate.value,
        snils: elements.snils.value.trim()
    };

    if (editingDriverIndex === -1) {
        // Добавление нового водителя
        driverData.id = Date.now(); // Простой ID на основе timestamp
        drivers.push(driverData);
    } else {
        // Редактирование существующего
        driverData.id = drivers[editingDriverIndex].id;
        drivers[editingDriverIndex] = driverData;
    }

    await saveDrivers();
    renderDriversList();

    // Возвращаемся к деталям водителя если редактировали
    if (editingDriverIndex !== -1) {
        selectDriver(driverData);
    } else {
        showScreen('welcome');
    }
}

// Очистить форму
function clearForm() {
    elements.driverForm.reset();
}

// Отмена редактирования
function cancelForm() {
    if (currentDriver) {
        showScreen('detail');
    } else {
        showScreen('welcome');
    }
}

// Загрузить шаблон
async function uploadTemplate() {
    try {
        const result = await api.uploadTemplate();
        if (result.success) {
            console.log('Шаблон загружен:', result.fileName);
            await loadTemplates();
            showToast('Шаблон успешно загружен!');
        }
    } catch (error) {
        console.error('Ошибка загрузки шаблона:', error);
        showToast('Ошибка загрузки шаблона', 'error', 5000);
    }
}

// Удалить шаблон
async function deleteTemplate(templateName) {
    try {
        const result = await api.deleteTemplate(templateName);
        if (result.success) {
            await loadTemplates();
            showToast('Шаблон удален');
        }
    } catch (error) {
        console.error('Ошибка удаления шаблона:', error);
        showToast('Ошибка удаления шаблона', 'error', 5000);
    }
}

// Открыть модальное окно для заполнения данных путевого листа
function openWaybillModal() {
    const templateName = elements.templateSelect.value;

    if (!templateName) {
        showToast('Выберите шаблон путевого листа', 'info');
        return;
    }

    if (!currentDriver) {
        showToast('Водитель не выбран', 'info');
        return;
    }

    // Загружаем сохранённые данные водителя если они есть
    if (currentDriver.waybillTemplate) {
        elements.vehicleModel.value = currentDriver.waybillTemplate.vehicleModel || '';
        elements.vehicleNumber.value = currentDriver.waybillTemplate.vehicleNumber || '';
        elements.departurePoint.value = currentDriver.waybillTemplate.departurePoint || '';
        elements.destination.value = currentDriver.waybillTemplate.destination || '';
        elements.route.value = currentDriver.waybillTemplate.route || '';
    } else {
        // Очищаем форму
        elements.waybillDataForm.reset();
    }

    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = getTodayDate();
    elements.waybillDateFrom.value = today;
    elements.waybillDateTo.value = today;

    elements.waybillNumber.value = '';

    // Заполняем список техники
    populateVehicleSelects();

    // Показываем модальное окно
    elements.waybillModal.style.display = 'flex';
}

// Форматировать диапазон дат (или одну дату если совпадают)
function formatDateRange(from, to) {
    const fmt = d => d ? d.split('-').reverse().join('.') : '';
    if (!from) return fmt(to);
    if (!to || from === to) return fmt(from);
    return `${fmt(from)} - ${fmt(to)}`;
}

// Закрыть модальное окно
function closeWaybillModal() {
    elements.waybillModal.style.display = 'none';
}

// Генерировать путевой лист
async function generateWaybill(e) {
    e.preventDefault();

    const templateName = elements.templateSelect.value;
    
    // Собираем данные из формы
    const waybillData = {
        date: formatDateRange(elements.waybillDateFrom.value, elements.waybillDateTo.value),
        number: elements.waybillNumber.value,
        vehicleModel: elements.vehicleModel.value.trim(),
        vehicleNumber: elements.vehicleNumber.value.trim(),
        departurePoint: elements.departurePoint.value.trim(),
        destination: elements.destination.value.trim(),
        departureTime: elements.departureTime.value,
        returnTime: elements.returnTime.value,
        odometerStart: elements.odometerStart.value,
        odometerEnd: elements.odometerEnd.value,
        route: elements.route.value.trim()
    };

    // Сохраняем шаблон водителя для последующего использования
    currentDriver.waybillTemplate = {
        vehicleModel: waybillData.vehicleModel,
        vehicleNumber: waybillData.vehicleNumber,
        departurePoint: waybillData.departurePoint,
        destination: waybillData.destination,
        route: waybillData.route
    };

    // Находим индекс водителя и обновляем данные
    const driverIndex = drivers.findIndex(d => d.id === currentDriver.id);
    if (driverIndex !== -1) {
        drivers[driverIndex] = currentDriver;
        await saveDrivers();
    }

    // Закрываем модальное окно
    closeWaybillModal();

    try {
        const result = await api.generateWaybill(templateName, currentDriver, waybillData);

        if (result.success) {
            if (result.usedMapping) {
                showToast(`Путевой лист создан!\nЗаполнено полей: ${result.fieldsFilled}\nФайл: ${result.fileName}`);
            } else if (result.fieldsFound === 0) {
                showToast(
                    `Путевой лист сохранён, но данные не были вставлены.\n` +
                    `Убедитесь, что шаблон содержит AcroForm-поля с нужными именами.\n` +
                    `Файл: ${result.fileName}`,
                    'info', 5000
                );
            } else {
                showToast(`Путевой лист создан!\nЗаполнено полей: ${result.fieldsFilled} из ${result.fieldsFound}\nФайл: ${result.fileName}`);
            }
            await api.openGeneratedFolder();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Ошибка генерации путевого листа:', error);
        showToast('Ошибка создания путевого листа: ' + error.message, 'error', 5000);
    }
}

// Обработчики событий
function setupEventListeners() {
    // Управление водителями
    elements.addDriverBtn.addEventListener('click', addNewDriver);
    elements.backToWelcomeBtn.addEventListener('click', () => showScreen('welcome'));
    elements.editDriverBtn.addEventListener('click', editDriver);
    elements.deleteDriverBtn.addEventListener('click', deleteDriver);

    // Форма
    elements.driverForm.addEventListener('submit', saveDriver);
    elements.cancelFormBtn.addEventListener('click', cancelForm);
    elements.cancelFormBtn2.addEventListener('click', cancelForm);

    // Убираем визуальные ошибки при вводе
    const formControls = document.querySelectorAll('.form-control');
    formControls.forEach(control => {
        control.addEventListener('input', function() {
            this.classList.remove('error');
        });
    });

    // Поиск
    elements.searchInput.addEventListener('input', (e) => {
        renderDriversList(e.target.value);
    });

    // Шаблоны
    elements.uploadTemplateBtn.addEventListener('click', uploadTemplate);

    // Генерация путевого листа
    elements.generateWaybillBtn.addEventListener('click', openWaybillModal);
    elements.waybillDataForm.addEventListener('submit', generateWaybill);

    // Модальное окно
    elements.closeModalBtn.addEventListener('click', closeWaybillModal);
    elements.cancelModalBtn.addEventListener('click', closeWaybillModal);

    // Закрытие модального окна при клике вне его
    elements.waybillModal.addEventListener('click', (e) => {
        if (e.target === elements.waybillModal) {
            closeWaybillModal();
        }
    });

    // Кнопки открытия папки
    elements.openFolderBtn.addEventListener('click', async () => {
        await api.openGeneratedFolder();
    });

    elements.openFolderBtnWelcome.addEventListener('click', async () => {
        await api.openGeneratedFolder();
    });

    // Редактор маппинга
    elements.editorBackBtn.addEventListener('click', () => {
        showScreen('welcome');
    });

    elements.saveFieldMappingBtn.addEventListener('click', saveFieldMapping);

    elements.prevPageBtn.addEventListener('click', async () => {
        if (pdfCurrentPage > 1) {
            pdfCurrentPage--;
            await renderPdfPage(pdfCurrentPage);
            updatePageNav();
        }
    });

    elements.nextPageBtn.addEventListener('click', async () => {
        if (pdfCurrentPage < pdfTotalPages) {
            pdfCurrentPage++;
            await renderPdfPage(pdfCurrentPage);
            updatePageNav();
        }
    });

    elements.canvasWrapper.addEventListener('click', handleCanvasClick);

    // Пакетная генерация
    document.getElementById('batchGenerateBtn').addEventListener('click', openBatchModal);
    elements.batchDriverTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.batch-driver-tab');
        if (tab) switchBatchDriver(Number(tab.dataset.id));
    });
    document.getElementById('batchClearBtn').addEventListener('click', () => {
        selectedDriverIds.clear();
        renderDriversList();
    });
    document.getElementById('closeBatchModalBtn').addEventListener('click', closeBatchModal);
    document.getElementById('cancelBatchModalBtn').addEventListener('click', closeBatchModal);
    elements.batchModal.addEventListener('click', (e) => {
        if (e.target === elements.batchModal) closeBatchModal();
    });
    elements.batchWaybillForm.addEventListener('submit', generateBatchWaybills);

    // Список техники
    document.getElementById('vehicleSearchInput').addEventListener('input', (e) => {
        renderVehiclesList(e.target.value);
    });
    elements.vehiclesBtn.addEventListener('click', openVehiclesModal);
    document.getElementById('closeVehiclesModalBtn').addEventListener('click', closeVehiclesModal);
    elements.vehiclesModal.addEventListener('click', (e) => {
        if (e.target === elements.vehiclesModal) closeVehiclesModal();
    });
    document.getElementById('addVehicleBtn').addEventListener('click', addVehicle);
    document.getElementById('newVehicleNumber').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addVehicle(); }
    });
    elements.vehiclesList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-vehicle');
        if (editBtn) { editVehicle(Number(editBtn.dataset.id)); return; }
        const saveBtn = e.target.closest('.btn-save-vehicle');
        if (saveBtn) { saveVehicleEdit(Number(saveBtn.dataset.id), saveBtn.closest('.vehicle-edit-form')); return; }
        const cancelBtn = e.target.closest('.btn-cancel-vehicle');
        if (cancelBtn) { renderVehiclesList(document.getElementById('vehicleSearchInput').value); return; }
        const btn = e.target.closest('.btn-delete-vehicle');
        if (btn) { deleteVehicle(Number(btn.dataset.id)); return; }
        // Клик на строку машины (не на кнопки) — открыть журнал обслуживания
        const vehicleItem = e.target.closest('.vehicle-item');
        if (vehicleItem && !e.target.closest('.vehicle-actions')) {
            openMaintenanceModal(Number(vehicleItem.dataset.id));
        }
    });

    // Выбор ТС из выпадающего списка заполняет поля марки/номера
    elements.vehicleSelect.addEventListener('change', (e) => {
        const v = vehicles.find(x => x.id === Number(e.target.value));
        if (v) {
            elements.vehicleModel.value = v.model;
            elements.vehicleNumber.value = v.number;
        }
    });
    elements.batchVehicleSelect.addEventListener('change', (e) => {
        const v = vehicles.find(x => x.id === Number(e.target.value));
        if (v) {
            document.getElementById('batchVehicleModel').value = v.model;
            document.getElementById('batchVehicleNumber').value = v.number;
        }
    });

    // Кнопки генерации + печать
    document.getElementById('generateAndPrintBtn').addEventListener('click', generateAndPrint);
    document.getElementById('generateBatchAndPrintBtn').addEventListener('click', generateBatchAndPrint);

    // Модал выбора принтера
    document.getElementById('closePrinterModalBtn').addEventListener('click', closePrinterSelectModal);
    document.getElementById('cancelPrintBtn').addEventListener('click', closePrinterSelectModal);
    document.getElementById('printerModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('printerModal')) closePrinterSelectModal();
    });
    document.getElementById('printersList').addEventListener('click', (e) => {
        const item = e.target.closest('.printer-item');
        if (item) selectPrinter(item.dataset.name);
    });
    document.getElementById('confirmPrintBtn').addEventListener('click', () => {
        if (!selectedPrinterName) return;
        const cb = printerModalCallback;
        const printer = selectedPrinterName;
        closePrinterSelectModal();
        if (cb) cb(printer);
    });

    // ===== Журнал обслуживания =====
    document.getElementById('closeMaintenanceModalBtn').addEventListener('click', closeMaintenanceModal);
    document.getElementById('closeMaintenanceBtn').addEventListener('click', closeMaintenanceModal);
    elements.vehicleMaintenanceModal.addEventListener('click', (e) => {
        if (e.target === elements.vehicleMaintenanceModal) closeMaintenanceModal();
    });
    document.getElementById('addMaintenanceRowBtn').addEventListener('click', addMaintenanceRow);
    document.getElementById('saveMaintenanceBtn').addEventListener('click', saveMaintenanceRecords);
    document.getElementById('openMechanicsPopupBtn').addEventListener('click', openMechanicsPopup);

    // Печать журнала
    document.getElementById('printMaintenanceBtn').addEventListener('click', () => {
        collectMaintenanceFromDOM();
        if (maintenanceRecords.length === 0) { showToast('Нет записей', 'info'); return; }
        document.getElementById('maintenancePrintDateFrom').value = '';
        document.getElementById('maintenancePrintDateTo').value = '';
        document.getElementById('maintenancePrintModal').style.display = 'flex';
    });
    document.getElementById('closeMaintenancePrintModalBtn').addEventListener('click', () => {
        document.getElementById('maintenancePrintModal').style.display = 'none';
    });
    document.getElementById('cancelMaintenancePrintBtn').addEventListener('click', () => {
        document.getElementById('maintenancePrintModal').style.display = 'none';
    });
    document.getElementById('confirmMaintenancePrintBtn').addEventListener('click', printMaintenanceJournal);
    document.getElementById('saveMaintenancePdfBtn').addEventListener('click', saveMaintenancePdf);
    document.getElementById('openMaintenanceReportsFolderBtn').addEventListener('click', () => {
        api.openMaintenanceReportsFolder();
    });

    elements.maintenanceTableBody.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.btn-delete-maintenance');
        if (delBtn) { deleteMaintenanceRow(Number(delBtn.dataset.index)); return; }
        if (e.target.classList.contains('m-workers')) {
            document.querySelectorAll('.workers-dropdown').forEach(d => d.remove());
            showWorkersDropdown(e.target);
        }
    });

    elements.maintenanceTableBody.addEventListener('input', (e) => {
        if (e.target.matches('textarea.m-input')) autoResizeTextarea(e.target);
    });

    elements.maintenanceTableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('m-completed')) {
            const row = e.target.closest('.maintenance-row');
            if (row) row.classList.toggle('maintenance-completed', e.target.checked);
        }
    });

    elements.maintenanceTableBody.addEventListener('focus', (e) => {
        if (e.target.classList.contains('m-workers')) {
            lastFocusedWorkersTextarea = e.target;
        }
    }, true);

    // ===== Попап слесарей =====
    document.getElementById('closeMechanicsPopupBtn').addEventListener('click', closeMechanicsPopup);
    elements.mechanicsPopup.addEventListener('click', (e) => {
        if (e.target === elements.mechanicsPopup) { closeMechanicsPopup(); return; }
        const nameItem = e.target.closest('.mechanics-name-item');
        if (nameItem && !e.target.closest('.btn-delete-mechanic')) {
            insertWorkerName(nameItem.dataset.fio);
            return;
        }
        const delBtn = e.target.closest('.btn-delete-mechanic');
        if (delBtn) deleteMechanic(Number(delBtn.dataset.index));
    });
    document.getElementById('addMechanicBtn').addEventListener('click', addMechanic);
    document.getElementById('newMechanicMiddleName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addMechanic(); }
    });
}

// ===== РЕДАКТОР МАППИНГА ПОЛЕЙ =====

// Состояние редактора
let editorTemplateName = null;
let editorMapping = { fields: [] };
let pdfJsDoc = null;
let pdfCurrentPage = 1;
let pdfTotalPages = 1;
let isDraggingMarker = false; // блокирует handleCanvasClick во время перетаскивания

// Метки полей для отображения
const FIELD_LABELS = {
    fio: 'ФИО', lastName: 'Фамилия', firstName: 'Имя', middleName: 'Отчество',
    license: 'Вод. удостоверение', category: 'Категория', snils: 'СНИЛС',
    tabNumber: 'Таб. номер', driverClass: 'Класс', experience: 'Стаж',
    date: 'Дата', number: 'Номер ПЛ', vehicleModel: 'Марка ТС',
    vehicleNumber: 'Гос. номер', departurePoint: 'Отправление',
    destination: 'Назначение', departureTime: 'Выезд', returnTime: 'Возврат',
    odometerStart: 'Одометр↑', odometerEnd: 'Одометр↓', route: 'Маршрут'
};

// Примеры текста для предпросмотра в редакторе
const FIELD_SAMPLES = {
    fio: 'Иванов Иван Иванович',
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    license: '12 34 567890 01.01.2020',
    category: 'B',
    snils: '123-456-789 00',
    tabNumber: '42',
    driverClass: '2',
    experience: '10',
    date: '01.01.2025 — 31.01.2025',
    number: '001',
    vehicleModel: 'ГАЗель Next',
    vehicleNumber: 'А123БВ777',
    departurePoint: 'г. Москва',
    destination: 'г. Санкт-Петербург',
    departureTime: '08:00',
    returnTime: '18:00',
    odometerStart: '12345',
    odometerEnd: '12567',
    route: 'Москва — Санкт-Петербург'
};

// Открыть редактор для шаблона
async function openTemplateEditor(templateName) {
    editorTemplateName = templateName;
    elements.editorTemplateName.textContent = templateName;

    // Загружаем существующий маппинг
    try {
        editorMapping = await api.getFieldMapping(templateName);
        if (!editorMapping.fields) editorMapping = { fields: [] };
    } catch (e) {
        editorMapping = { fields: [] };
    }

    // Показываем экран редактора
    showScreen('editor');

    // Инициализируем PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js';
    }

    // Загружаем PDF
    await loadEditorPdf(templateName);
    renderPlacedFieldsList();
}

// Загрузить PDF в редактор
async function loadEditorPdf(templateName) {
    try {
        const result = await api.readTemplate(templateName);
        if (!result.success) throw new Error(result.error);

        const uint8Array = new Uint8Array(result.data);
        pdfJsDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        pdfTotalPages = pdfJsDoc.numPages;
        pdfCurrentPage = 1;
        await renderPdfPage(pdfCurrentPage);
        updatePageNav();
    } catch (error) {
        console.error('Ошибка загрузки PDF в редактор:', error);
        showToast('Ошибка загрузки шаблона: ' + error.message, 'error', 5000);
    }
}

// Отрисовать страницу PDF
async function renderPdfPage(pageNum) {
    if (!pdfJsDoc) return;
    const page = await pdfJsDoc.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = elements.pdfCanvas;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    renderFieldMarkers();
}

// Обновить навигацию по страницам
function updatePageNav() {
    elements.pageInfo.textContent = `Стр. ${pdfCurrentPage} из ${pdfTotalPages}`;
    elements.prevPageBtn.disabled = pdfCurrentPage <= 1;
    elements.nextPageBtn.disabled = pdfCurrentPage >= pdfTotalPages;
}

// Отрисовать маркеры полей на канвасе
async function renderFieldMarkers() {
    elements.canvasWrapper.querySelectorAll('.field-marker, .field-preview-text, .field-width-guide').forEach(m => m.remove());
    if (!pdfJsDoc) return;

    const currentPageFields = editorMapping.fields.filter(f => (f.page + 1) === pdfCurrentPage);
    if (currentPageFields.length === 0) return;

    const page = await pdfJsDoc.getPage(pdfCurrentPage);
    const viewport = page.getViewport({ scale: 1.5 });
    const pageRotation = page.rotate || 0;

    currentPageFields.forEach(field => {
        // Конвертируем PDF-координаты обратно в canvas-координаты
        const [canvasX, canvasY] = viewport.convertToViewportPoint(field.pdfX, field.pdfY);
        const fs = field.fontSize || 10;
        const canvasFontSize = fs * 1.5;

        // Применяем ту же поправку baseline, что и main.js при drawText,
        // чтобы превью точно совпало с итоговым положением текста в PDF
        let correctedPdfX = field.pdfX;
        let correctedPdfY = field.pdfY;
        if (pageRotation === 90)       correctedPdfX -= fs;
        else if (pageRotation === 270) correctedPdfX += fs;
        else if (pageRotation === 180) correctedPdfY += fs;
        else                           correctedPdfY -= fs;
        const [previewX, previewY] = viewport.convertToViewportPoint(correctedPdfX, correctedPdfY);

        // Предпросмотр текста — отображает пример данных в нужном масштабе
        const preview = document.createElement('div');
        preview.className = 'field-preview-text';
        preview.textContent = FIELD_SAMPLES[field.dataKey] || (FIELD_LABELS[field.dataKey] || field.dataKey);
        preview.style.left = previewX + 'px';
        preview.style.top = previewY + 'px';
        preview.style.fontSize = canvasFontSize + 'px';
        // Показываем ширину поля визуально
        if (field.maxWidth) {
            preview.style.maxWidth = (field.maxWidth * 1.5) + 'px';
            preview.style.overflow = 'hidden';
            preview.style.textOverflow = 'ellipsis';
        }
        elements.canvasWrapper.appendChild(preview);

        // Визуальная рамка ширины поля
        if (field.maxWidth) {
            const widthGuide = document.createElement('div');
            widthGuide.className = 'field-width-guide';
            widthGuide.style.left = previewX + 'px';
            widthGuide.style.top = previewY + 'px';
            widthGuide.style.width = (field.maxWidth * 1.5) + 'px';
            widthGuide.style.height = (canvasFontSize * 1.3) + 'px';
            elements.canvasWrapper.appendChild(widthGuide);
        }

        // Метка с именем поля и кнопкой удаления (на исходной точке клика)
        const marker = document.createElement('div');
        marker.className = 'field-marker';
        marker.textContent = FIELD_LABELS[field.dataKey] || field.dataKey;
        marker.style.left = canvasX + 'px';
        marker.style.top = canvasY + 'px';
        marker.title = 'Тяни чтобы переместить • Клик чтобы удалить';

        // --- Drag-and-drop ---
        marker.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            let wasDragged = false;
            const startMouseX = e.clientX;
            const startMouseY = e.clientY;
            const startLeft   = parseFloat(marker.style.left);
            const startTop    = parseFloat(marker.style.top);
            const startPrevX  = parseFloat(preview.style.left);
            const startPrevY  = parseFloat(preview.style.top);

            const onMove = (ev) => {
                const dx = ev.clientX - startMouseX;
                const dy = ev.clientY - startMouseY;
                if (!wasDragged && Math.abs(dx) + Math.abs(dy) > 4) {
                    wasDragged = true;
                    isDraggingMarker = true;
                    marker.classList.add('dragging');
                }
                if (wasDragged) {
                    marker.style.left  = (startLeft  + dx) + 'px';
                    marker.style.top   = (startTop   + dy) + 'px';
                    preview.style.left = (startPrevX + dx) + 'px';
                    preview.style.top  = (startPrevY + dy) + 'px';
                }
            };

            const onUp = async () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                marker.classList.remove('dragging');
                if (!wasDragged) return;
                // Конвертируем новую canvas-позицию метки обратно в PDF-координаты
                const newCanvasX = parseFloat(marker.style.left);
                const newCanvasY = parseFloat(marker.style.top);
                const [newPdfX, newPdfY] = viewport.convertToPdfPoint(newCanvasX, newCanvasY);
                const idx = editorMapping.fields.findIndex(f => f.id === field.id);
                if (idx !== -1) {
                    editorMapping.fields[idx].pdfX = newPdfX;
                    editorMapping.fields[idx].pdfY = newPdfY;
                }
                await renderFieldMarkers();
                renderPlacedFieldsList();
                setTimeout(() => { isDraggingMarker = false; }, 0);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Клик для удаления (только если не было перетаскивания)
        marker.addEventListener('click', (e) => {
            if (isDraggingMarker) return;
            e.stopPropagation();
            editorMapping.fields = editorMapping.fields.filter(f => f.id !== field.id);
            renderFieldMarkers();
            renderPlacedFieldsList();
        });

        elements.canvasWrapper.appendChild(marker);
    });
}

// Отрисовать список размещённых полей в боковой панели
function renderPlacedFieldsList() {
    const list = elements.placedFieldsList;
    elements.fieldsCount.textContent = editorMapping.fields.length;

    if (editorMapping.fields.length === 0) {
        list.innerHTML = '<p class="editor-empty">Нет размещённых полей</p>';
        return;
    }

    list.innerHTML = '';
    editorMapping.fields.forEach(field => {
        const item = document.createElement('div');
        item.className = 'placed-field-item';
        item.innerHTML = `
            <div class="field-item-top">
                <span class="field-label">${FIELD_LABELS[field.dataKey] || field.dataKey}</span>
                <span class="field-page">стр.${field.page + 1}</span>
                <button class="field-delete" title="Удалить">×</button>
            </div>
            <div class="field-item-bottom">
                <label>Ш:</label>
                <input type="range" class="field-width-range" min="30" max="600" value="${field.maxWidth || 150}">
                <span class="field-width-value">${field.maxWidth || 150}</span>
            </div>
        `;
        item.querySelector('.field-delete').addEventListener('click', () => {
            editorMapping.fields = editorMapping.fields.filter(f => f.id !== field.id);
            renderFieldMarkers();
            renderPlacedFieldsList();
        });
        item.querySelector('.field-width-range').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            field.maxWidth = val;
            item.querySelector('.field-width-value').textContent = val;
            renderFieldMarkers();
        });
        list.appendChild(item);
    });
}

// Поставить маркер по клику на канвас
async function handleCanvasClick(e) {
    if (isDraggingMarker) return; // игнорируем клик после перетаскивания
    const selectedKey = elements.fieldTypeSelect.value;
    if (!selectedKey) {
        showToast('Сначала выберите поле из списка слева', 'info');
        return;
    }
    if (!pdfJsDoc) return;

    const canvas = elements.pdfCanvas;
    const rect = canvas.getBoundingClientRect();

    // Учитываем разницу между CSS-размером и внутренним разрешением canvas
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Конвертируем в PDF-координаты с учётом поворота страницы
    const page = await pdfJsDoc.getPage(pdfCurrentPage);
    const viewport = page.getViewport({ scale: 1.5 });
    const [pdfX, pdfY] = viewport.convertToPdfPoint(canvasX, canvasY);

    const field = {
        id: Date.now().toString(),
        dataKey: selectedKey,
        label: FIELD_LABELS[selectedKey] || selectedKey,
        page: pdfCurrentPage - 1,
        pdfX,
        pdfY,
        fontSize: parseInt(elements.editorFontSize.value) || 10,
        maxWidth: 150
    };

    editorMapping.fields.push(field);
    await renderFieldMarkers();
    renderPlacedFieldsList();
}

// Сохранить маппинг
async function saveFieldMapping() {
    if (!editorTemplateName) return;
    try {
        const result = await api.saveFieldMapping(editorTemplateName, editorMapping);
        if (result.success) {
            showToast(`Маппинг сохранён! Размещено полей: ${editorMapping.fields.length}`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showToast('Ошибка сохранения: ' + error.message, 'error', 5000);
    }
}

// Запуск приложения
init();