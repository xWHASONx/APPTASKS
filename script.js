document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "tu-proyecto.firebaseapp.com",
        projectId: "tu-proyecto",
        storageBucket: "tu-proyecto.appspot.com",
        messagingSenderId: "...",
        appId: "..."
    };

    // --- INICIALIZACIÓN DE SERVICIOS ---
    try {
        firebase.initializeApp(firebaseConfig);
    } catch (e) {
        alert("Error de configuración de Firebase. Revisa la consola.");
    }
    const db = firebase.firestore();
    const storage = firebase.storage();

    // --- ESTADO GLOBAL ---
    const departments = { 'TECH': '💻', 'VENTAS': '💰', 'MARKETING': '📈', 'RESERVAS': '📅', 'ADMINISTRATIVA': '🗂️' };
    let currentDepartment = null;
    let unsubscribe = null;
    const notificationSound = new Audio('notification.mp3');
    let isFirstLoad = true;
    let currentFilter = 'pending';

    // --- ELEMENTOS DEL DOM ---
    const dashboardView = document.getElementById('dashboard-view');
    const tasksView = document.getElementById('tasks-view');
    const departmentsGrid = document.getElementById('departments-grid');
    const taskList = document.getElementById('task-list');
    const departmentTitle = document.getElementById('department-title');
    const backBtn = document.getElementById('back-to-dashboard');
    const filterBar = document.querySelector('.filter-bar');
    // Toolbars
    const toolbarStandard = document.getElementById('toolbar-standard');
    const toolbarMarketing = document.getElementById('toolbar-marketing');
    // Toolbar Standard Fields
    const tNameInput = document.getElementById('tName');
    const tDescInput = document.getElementById('tDesc');
    const tUrgentCheckbox = document.getElementById('tUrgent');
    const addTaskBtn = document.getElementById('add-task-btn');
    // Toolbar Marketing Fields
    const mAdTypeInput = document.getElementById('mAdType');
    const mContentInput = document.getElementById('mContent');
    const referencesContainer = document.getElementById('references-container');
    const addMoreFilesBtn = document.getElementById('add-more-files-btn');
    const addMarketingTaskBtn = document.getElementById('add-marketing-task-btn');
    
    // --- LÓGICA DE MODO OSCURO ---
    const themeToggles = [document.getElementById('theme-toggle-dashboard'), document.getElementById('theme-toggle-tasks')];
    
    function applyTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        themeToggles.forEach(toggle => toggle.checked = isDark);
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        themeToggles.forEach(toggle => toggle.checked = isDark);
    }

    themeToggles.forEach(toggle => toggle.addEventListener('change', toggleTheme));
    // Aplicar tema guardado al cargar
    const savedTheme = localStorage.getItem('darkMode') === 'true';
    applyTheme(savedTheme);

    // --- LÓGICA DE NAVEGACIÓN ---
    function showDashboard() {
        dashboardView.classList.add('active');
        tasksView.classList.remove('active');
        if (unsubscribe) unsubscribe();
    }

    function showTasks(department) {
        dashboardView.classList.remove('active');
        tasksView.classList.add('active');
        currentDepartment = department;
        departmentTitle.textContent = department;
        
        // Mostrar la toolbar correcta
        if (department === 'MARKETING') {
            toolbarStandard.style.display = 'none';
            toolbarMarketing.style.display = 'grid';
        } else {
            toolbarStandard.style.display = 'grid';
            toolbarMarketing.style.display = 'none';
        }
        
        listenForTasks();
    }

    // --- LÓGICA DE DATOS ---
    function listenForTasks() {
        if (!currentDepartment) return;
        if (unsubscribe) unsubscribe();
        
        isFirstLoad = true;
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        
        unsubscribe = db.collection(collectionName).orderBy('orden', 'desc')
            .onSnapshot(snapshot => {
                if (!isFirstLoad) notificationSound.play().catch(e => {});
                isFirstLoad = false;
                
                const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderTasks(allTasks);
            }, error => console.error("Error al escuchar tareas: ", error));
    }

    // --- ACCIONES DE TAREAS ---
    addTaskBtn.addEventListener('click', () => { // Para tareas estándar
        const name = tNameInput.value.trim();
        const description = tDescInput.value.trim();
        if (!name) return;
        db.collection(`tasks_${currentDepartment.toUpperCase()}`).add({
            name, description, done: false, urgent: tUrgentCheckbox.checked, orden: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tNameInput.value = ''; tDescInput.value = ''; tUrgentCheckbox.checked = false;
    });

    addMarketingTaskBtn.addEventListener('click', async () => { // Para tareas de Marketing
        const adType = mAdTypeInput.value.trim();
        const content = mContentInput.value.trim();
        if (!adType) { alert('El tipo de anuncio es obligatorio.'); return; }

        const fileInputs = referencesContainer.querySelectorAll('.reference-file');
        const files = Array.from(fileInputs).map(input => input.files[0]).filter(file => file);
        
        addMarketingTaskBtn.textContent = 'Subiendo...';
        addMarketingTaskBtn.disabled = true;

        const referenceURLs = await Promise.all(
            files.map(file => uploadFile(file))
        );

        db.collection(`tasks_MARKETING`).add({
            adType, content, done: false, urgent: false, orden: Date.now(),
            references: referenceURLs,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        mAdTypeInput.value = ''; mContentInput.value = '';
        referencesContainer.innerHTML = '<label>Imágenes de Referencia:</label><div class="file-input-wrapper"><input type="file" class="reference-file" accept="image/*"></div>';
        addMarketingTaskBtn.textContent = 'Añadir Anuncio';
        addMarketingTaskBtn.disabled = false;
    });

    async function uploadFile(file) {
        const filePath = `references/${currentDepartment}/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        await fileRef.put(file);
        return await fileRef.getDownloadURL();
    }

    addMoreFilesBtn.addEventListener('click', () => {
        const newInputWrapper = document.createElement('div');
        newInputWrapper.className = 'file-input-wrapper';
        newInputWrapper.innerHTML = '<input type="file" class="reference-file" accept="image/*">';
        referencesContainer.appendChild(newInputWrapper);
    });
    
    // --- LÓGICA DRAG & DROP, FILTROS, RENDERIZADO --- (el resto del script)
    
    new Sortable(taskList, { animation: 150, handle: '.task-item', ghostClass: 'sortable-ghost', onEnd: saveOrder });
    
    function saveOrder() {
        // ... (código sin cambios)
    }

    function renderTasks(allTasks) {
        taskList.innerHTML = '';
        const filteredTasks = allTasks.filter(task => (currentFilter === 'pending' ? !task.done : task.done));

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `<div class="no-tasks">🎉 No hay tareas en esta vista.</div>`; return;
        }

        filteredTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            if (task.done) item.classList.add('done');
            if (task.urgent) item.classList.add('urgent');
            item.dataset.id = task.id;
            
            // Renderizado condicional
            if (currentDepartment === 'MARKETING') {
                item.innerHTML = renderMarketingTask(task);
            } else {
                item.innerHTML = renderStandardTask(task);
            }

            // Event Listeners (simplificado, ya que los botones son los mismos)
            item.querySelector('.toggle-status').addEventListener('change', () => db.collection(`tasks_${currentDepartment.toUpperCase()}`).doc(task.id).update({ done: !task.done }));
            item.querySelector('.delete-btn').addEventListener('click', () => { if (confirm('¿Eliminar?')) db.collection(`tasks_${currentDepartment.toUpperCase()}`).doc(task.id).delete(); });
            
            taskList.appendChild(item);
        });
    }

    function renderStandardTask(task) {
        const urgentIcon = task.urgent ? `<span class="urgent-icon" title="¡Urgente!">🔥</span>` : '';
        const createdAt = task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : '';
        return `
            <input type="checkbox" class="toggle-status" ${task.done ? 'checked' : ''}>
            <div class="task-details">
                <div class="task-name">${task.name}</div>
                <div class="task-desc">${task.description || ''}</div>
                <div class="task-meta"><span>${createdAt}</span>${urgentIcon}</div>
            </div>
            <div class="task-actions">
                <button class="edit-btn" title="Editar tarea">✏️</button>
                <button class="delete-btn" title="Eliminar tarea">🗑️</button>
            </div>`;
    }

    function renderMarketingTask(task) {
        let referencesHTML = '';
        if (task.references && task.references.length > 0) {
            referencesHTML += '<div class="references-grid">';
            task.references.forEach(url => {
                referencesHTML += `<a href="${url}" target="_blank"><img src="${url}" class="ref-thumbnail"></a>`;
            });
            referencesHTML += '</div>';
        }
        return `
            <input type="checkbox" class="toggle-status" ${task.done ? 'checked' : ''}>
            <div class="task-details">
                <div class="task-name">${task.adType}</div>
                <div class="task-content">${task.content || ''}</div>
                ${referencesHTML}
            </div>
            <div class="task-actions">
                <button class="delete-btn" title="Eliminar tarea">🗑️</button>
            </div>`;
    }

    function renderDashboard() {
        departmentsGrid.innerHTML = '';
        for (const [name, icon] of Object.entries(departments)) {
            const card = document.createElement('div');
            card.className = 'dept-card';
            card.addEventListener('click', () => showTasks(name));
            card.innerHTML = `<div class="card-icon">${icon}</div><div class="card-name">${name}</div>`;
            departmentsGrid.appendChild(card);
        }
    }
    
    // --- EVENTOS GLOBALES ---
    backBtn.addEventListener('click', showDashboard);
    filterBar.addEventListener('click', e => {
        if (e.target.matches('.filter-btn')) {
            filterBar.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            listenForTasks();
        }
    });
    
    // --- INICIALIZACIÓN ---
    renderDashboard();
});
