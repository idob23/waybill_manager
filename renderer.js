// renderer.js - Логика приложения (Renderer процесс)
// Используем безопасный API из preload.js через window.electronAPI

// api — псевдоним для electronAPI из preload.js (contextBridge)
// Нельзя использовать имя "electronAPI" — оно уже занято contextBridge как глобальная переменная
const api = window['electronAPI'];

// Глобальные переменные
let drivers = []; // Массив всех водителей
let currentDriver = null; // Текущий выбранный водитель
let editingDriverIndex = -1; // Индекс редактируемого водителя (-1 = добавление нового)

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

    // Модальное окно
    waybillModal: document.getElementById('waybillModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    waybillDataForm: document.getElementById('waybillDataForm'),

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
    renderDriversList();
}

// Загрузить водителей из файла
async function loadDrivers() {
    try {
        drivers = await api.getDrivers();
        console.log('Загружено водителей:', drivers.length);
    } catch (error) {
        console.error('Ошибка загрузки водителей:', error);
        alert('Ошибка загрузки данных водителей');
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
        alert('Ошибка сохранения данных');
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
    
    filteredDrivers.forEach((driver, index) => {
        const driverItem = document.createElement('div');
        driverItem.className = 'driver-item';
        if (currentDriver && currentDriver.id === driver.id) {
            driverItem.classList.add('active');
        }
        
        const licenseStr = [driver.licenseSerial, driver.licenseNumber].filter(Boolean).join(' ') || driver.license || '—';
        driverItem.innerHTML = `
            <h3>${driver.lastName} ${driver.firstName}</h3>
            <p>📄 В/У: ${licenseStr}</p>
            <p>🪪 СНИЛС: ${driver.snils || '—'}</p>
        `;
        
        // Клик по водителю - показать детали
        driverItem.addEventListener('click', () => {
            selectDriver(driver);
        });
        
        elements.driversList.appendChild(driverItem);
    });
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
            if (confirm(`Удалить шаблон "${template}"?`)) {
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
    
    const confirmed = confirm(`Удалить водителя ${currentDriver.lastName} ${currentDriver.firstName}?`);
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
        alert('Ошибки:\n\n' + errors.join('\n'));
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
            alert('Шаблон успешно загружен!');
        }
    } catch (error) {
        console.error('Ошибка загрузки шаблона:', error);
        alert('Ошибка загрузки шаблона');
    }
}

// Удалить шаблон
async function deleteTemplate(templateName) {
    try {
        const result = await api.deleteTemplate(templateName);
        if (result.success) {
            await loadTemplates();
            alert('Шаблон удален');
        }
    } catch (error) {
        console.error('Ошибка удаления шаблона:', error);
        alert('Ошибка удаления шаблона');
    }
}

// Открыть модальное окно для заполнения данных путевого листа
function openWaybillModal() {
    const templateName = elements.templateSelect.value;

    if (!templateName) {
        alert('Выберите шаблон путевого листа');
        return;
    }

    if (!currentDriver) {
        alert('Водитель не выбран');
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
    const today = new Date().toISOString().split('T')[0];
    elements.waybillDateFrom.value = today;
    elements.waybillDateTo.value = today;

    // Генерируем номер путевого листа (дата + инициалы)
    const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '');
    const initials = currentDriver.lastName.charAt(0) + currentDriver.firstName.charAt(0);
    elements.waybillNumber.value = `${dateStr}-${initials}-${Date.now().toString().slice(-4)}`;

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
        console.log('Генерация путевого листа для:', currentDriver.lastName, currentDriver.firstName);

        const result = await api.generateWaybill(templateName, currentDriver, waybillData);

        if (result.success) {
            if (result.usedMapping) {
                alert(`Путевой лист создан!\nЗаполнено полей: ${result.fieldsFilled}\nФайл: ${result.fileName}`);
            } else if (result.fieldsFound === 0) {
                alert(
                    `Путевой лист сохранён, но данные не были вставлены.\n` +
                    `Убедитесь, что шаблон содержит AcroForm-поля с нужными именами.\n\n` +
                    `Файл: ${result.fileName}`
                );
            } else {
                alert(`Путевой лист создан!\nЗаполнено полей: ${result.fieldsFilled} из ${result.fieldsFound}\nФайл: ${result.fileName}`);
            }
            await api.openGeneratedFolder();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Ошибка генерации путевого листа:', error);
        alert('Ошибка создания путевого листа: ' + error.message);
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
}

// ===== РЕДАКТОР МАППИНГА ПОЛЕЙ =====

// Состояние редактора
let editorTemplateName = null;
let editorMapping = { fields: [] };
let pdfJsDoc = null;
let pdfCurrentPage = 1;
let pdfTotalPages = 1;

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
        alert('Ошибка загрузки шаблона: ' + error.message);
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
    elements.canvasWrapper.querySelectorAll('.field-marker').forEach(m => m.remove());
    if (!pdfJsDoc) return;

    const currentPageFields = editorMapping.fields.filter(f => (f.page + 1) === pdfCurrentPage);
    if (currentPageFields.length === 0) return;

    const page = await pdfJsDoc.getPage(pdfCurrentPage);
    const viewport = page.getViewport({ scale: 1.5 });

    currentPageFields.forEach(field => {
        // Конвертируем PDF-координаты обратно в canvas-координаты
        const [canvasX, canvasY] = viewport.convertToViewportPoint(field.pdfX, field.pdfY);

        const marker = document.createElement('div');
        marker.className = 'field-marker';
        marker.textContent = FIELD_LABELS[field.dataKey] || field.dataKey;
        marker.style.left = canvasX + 'px';
        marker.style.top = canvasY + 'px';
        marker.title = 'Кликни чтобы удалить';

        marker.addEventListener('click', (e) => {
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
            <span class="field-label">${FIELD_LABELS[field.dataKey] || field.dataKey}</span>
            <span class="field-page">стр.${field.page + 1}</span>
            <button class="field-delete" title="Удалить">×</button>
        `;
        item.querySelector('.field-delete').addEventListener('click', () => {
            editorMapping.fields = editorMapping.fields.filter(f => f.id !== field.id);
            renderFieldMarkers();
            renderPlacedFieldsList();
        });
        list.appendChild(item);
    });
}

// Поставить маркер по клику на канвас
async function handleCanvasClick(e) {
    const selectedKey = elements.fieldTypeSelect.value;
    if (!selectedKey) {
        alert('Сначала выберите поле из списка слева');
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
        fontSize: parseInt(elements.editorFontSize.value) || 10
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
            alert(`Маппинг сохранён! Размещено полей: ${editorMapping.fields.length}`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Ошибка сохранения: ' + error.message);
    }
}

// Запуск приложения
init();