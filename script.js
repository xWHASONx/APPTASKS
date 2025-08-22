document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyCTeN6rZV5Fr3KY3zpUi6lH5YLhNmoEjh4",
        authDomain: "gestor-tareas-7a86a.firebaseapp.com",
        projectId: "gestor-tareas-7a86a",
        storageBucket: "gestor-tareas-7a86a.appspot.com",
        messagingSenderId: "504609983937",
        appId: "1:504609983937:web:151da729026e7839637340"
    };

    // --- INICIALIZACIÓN DE SERVICIOS ---
    try {
        firebase.initializeApp(firebaseConfig);
    } catch (e) {
        console.error("Error al inicializar Firebase. ¿Pegaste bien tu 'firebaseConfig'?", e);
        alert("Error de configuración de Firebase. Revisa la consola.");
    }
    const db = firebase.firestore();
    const storage = firebase.storage(); // NUEVO: Inicializar Firebase Storage

    // --- ESTADO GLOBAL ---
    const departments = { 'TECH': '💻', 'VENTAS': '💰', 'MARKETING': '📈', 'RESERVAS': '📅', 'ADMINISTRATIVA': '🗂️' };
    let currentDepartment = null;
    let unsubscribe = null;
    const notificationSound = new Audio('notification.mp3');
    let isFirstLoad = true;
    let currentFilter = 'pending';
    let localTasks = [];
    let searchTerm = '';

    // --- ELEMENTOS DEL DOM ---
    const dashboardView = document.getElementById('dashboard-view');
    const tasksView = document.getElementById('tasks-view');
    const departmentsGrid = document.getElementById('departments-grid');
    const taskList = document.getElementById('task-list');
    const departmentTitle = document.getElementById('department-title');
    const addTaskBtn = document.getElementById('add-task-btn');
    const tNameInput = document.getElementById('tName');
    const tDescInput = document.getElementById('tDesc');
    const tUrgentCheckbox = document.getElementById('tUrgent');
    const backBtn = document.getElementById('back-to-dashboard');
    const filterBar = document.querySelector('.filter-bar');
    const searchBar = document.getElementById('search-bar');
    // NUEVO: Elementos del formulario de Marketing
    const marketingToolbar = document.getElementById('marketing-toolbar');
    const mAdType = document.getElementById('m-ad-type');
    const mContent = document.getElementById('m-content');
    const referencesContainer = document.getElementById('references-container');
    const addReferenceBtn = document.getElementById('add-reference-btn');
    // Modal de edición
    const editModal = document.getElementById('edit-modal');
    // ... (resto de elementos del modal)

    // --- LÓGICA DE NAVEGACIÓN ---
    function showDashboard() {
        dashboardView.classList.add('active');
        tasksView.classList.remove('active');
        if (unsubscribe) unsubscribe();
        localTasks = [];
        searchBar.value = '';
        searchTerm = '';
    }

    function showTasks(department) {
        dashboardView.classList.remove('active');
        tasksView.classList.add('active');
        currentDepartment = department;
        departmentTitle.textContent = department;

        // NUEVO: Mostrar/ocultar campos de Marketing
        if (department === 'MARKETING') {
            marketingToolbar.style.display = 'grid';
            resetMarketingForm(); // Limpiar el formulario al entrar
        } else {
            marketingToolbar.style.display = 'none';
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
                const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (!isFirstLoad) {
                    notificationSound.play().catch(e => {});
                    const addedTask = newTasks.find(t => !localTasks.some(lt => lt.id === t.id));
                    if (addedTask) {
                        showNotification(`Nueva tarea en ${currentDepartment}: "${addedTask.name}"`);
                    }
                }
                
                localTasks = newTasks;
                renderTasks(); 
                isFirstLoad = false;
            }, error => console.error("Error al escuchar tareas: ", error));
    }

    // --- RENDERIZADO ---
    function renderTasks() { 
        taskList.innerHTML = '';
        let tasksToRender = localTasks.filter(task => {
            if (currentFilter === 'pending') return !task.done;
            if (currentFilter === 'completed') return task.done;
            return true;
        });

        if (searchTerm) {
            tasksToRender = tasksToRender.filter(task => 
                task.name.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm))
            );
        }

        if (tasksToRender.length === 0) {
            taskList.innerHTML = `<div class="no-tasks">🎉 No hay tareas que coincidan con tus filtros.</div>`;
            return;
        }

        tasksToRender.forEach(task => {
            const item = document.createElement('div');
            // ... (código existente de creación de item)

            // NUEVO: Lógica para renderizar campos de Marketing
            let marketingInfoHTML = '';
            if (currentDepartment === 'MARKETING') {
                const adType = task.adType ? `<div class="task-extra-info"><strong>Tipo:</strong> ${task.adType}</div>` : '';
                const content = task.content ? `<div class="task-extra-info"><strong>Copy:</strong> ${task.content}</div>` : '';
                let referencesHTML = '';
                if (task.referenciasUrls && task.referenciasUrls.length > 0) {
                    referencesHTML = '<div class="references-gallery">';
                    task.referenciasUrls.forEach(url => {
                        referencesHTML += `<a href="${url}" target="_blank"><img src="${url}" alt="Referencia"></a>`;
                    });
                    referencesHTML += '</div>';
                }
                marketingInfoHTML = adType + content + referencesHTML;
            }

            item.innerHTML = `
                <input type="checkbox" class="toggle-status" ${task.done ? 'checked' : ''}>
                <div class="task-details">
                    <div class="task-name">${task.name}</div>
                    <div class="task-desc">${task.description || ''}</div>
                    ${marketingInfoHTML} 
                    <div class="task-meta">
                        <span>${task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : ''}</span>
                        ${task.urgent ? `<span class="urgent-icon" title="¡Urgente!">🔥</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="edit-btn" title="Editar tarea">✏️</button>
                    <button class="delete-btn" title="Eliminar tarea">🗑️</button>
                </div>
            `;
            taskList.appendChild(item);
        });
    }

    function renderDashboard() { /* ... (sin cambios) ... */ }
    
    // --- DRAG & DROP ---
    // ... (sin cambios) ...

    // --- EVENTOS ---
    
    // NUEVO: Evento para añadir campos de imagen en Marketing
    addReferenceBtn.addEventListener('click', () => {
        const fileInputs = referencesContainer.querySelectorAll('input[type="file"]');
        if (fileInputs.length < 5) {
            const newInput = document.createElement('input');
            newInput.type = 'file';
            newInput.accept = 'image/*';
            referencesContainer.appendChild(newInput);
        } else {
            alert('Puedes añadir un máximo de 5 imágenes.');
        }
    });

    // MODIFICADO: Lógica para añadir tarea
    addTaskBtn.addEventListener('click', async () => {
        const name = tNameInput.value.trim();
        const description = tDescInput.value.trim();
        if (!name) { alert('El nombre de la tarea es obligatorio.'); return; }
        addTaskBtn.disabled = true; // Deshabilitar botón para evitar doble click
        addTaskBtn.textContent = 'Añadiendo...';

        let taskData = {
            name: name,
            description: description,
            done: false,
            urgent: tUrgentCheckbox.checked,
            orden: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Si estamos en Marketing, procesamos los campos extra
        if (currentDepartment === 'MARKETING') {
            taskData.adType = mAdType.value;
            taskData.content = mContent.value.trim();

            const fileInputs = referencesContainer.querySelectorAll('input[type="file"]');
            const files = Array.from(fileInputs).map(input => input.files[0]).filter(Boolean);

            if (files.length > 0) {
                const uploadPromises = files.map(file => {
                    const filePath = `marketing_references/${Date.now()}_${file.name}`;
                    const fileRef = storage.ref(filePath);
                    return fileRef.put(file).then(() => ({
                        url: fileRef.getDownloadURL(),
                        path: filePath
                    }));
                });
                
                const results = await Promise.all(uploadPromises);
                taskData.referenciasUrls = await Promise.all(results.map(r => r.url));
                taskData.referenciasPaths = results.map(r => r.path);
            }
        }
        
        // Añadir la tarea a Firestore
        try {
            await db.collection(`tasks_${currentDepartment.toUpperCase()}`).add(taskData);
            // Limpiar formularios
            tNameInput.value = '';
            tDescInput.value = '';
            tUrgentCheckbox.checked = false;
            if (currentDepartment === 'MARKETING') {
                resetMarketingForm();
            }
        } catch (error) {
            console.error("Error al añadir la tarea:", error);
            alert("Hubo un error al guardar la tarea.");
        } finally {
            addTaskBtn.disabled = false;
            addTaskBtn.textContent = 'Añadir';
        }
    });

    // MODIFICADO: Lógica de clics en la lista de tareas
    taskList.addEventListener('click', async (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        const docRef = db.collection(collectionName).doc(taskId);
        const doc = await docRef.get();
        if (!doc.exists) return;
        const taskData = doc.data();

        // Si se marca/desmarca una tarea
        if (e.target.matches('.toggle-status')) {
            const isCompleting = !taskData.done;
            // Si estamos en Marketing y se está completando una tarea con imágenes
            if (currentDepartment === 'MARKETING' && isCompleting && taskData.referenciasPaths) {
                const deletePromises = taskData.referenciasPaths.map(path => storage.ref(path).delete());
                try {
                    await Promise.all(deletePromises);
                    console.log("Imágenes de referencia eliminadas.");
                } catch (error) {
                    console.error("Error al eliminar imágenes:", error);
                }
            }
            docRef.update({ done: isCompleting });
        }
        // Si se elimina una tarea
        if (e.target.matches('.delete-btn')) {
            if (confirm('¿Eliminar esta tarea permanentemente?')) {
                // Si estamos en Marketing y la tarea tiene imágenes
                if (currentDepartment === 'MARKETING' && taskData.referenciasPaths) {
                     const deletePromises = taskData.referenciasPaths.map(path => storage.ref(path).delete());
                     try {
                         await Promise.all(deletePromises);
                         console.log("Imágenes de referencia eliminadas junto con la tarea.");
                     } catch (error) {
                         console.error("Error al eliminar imágenes:", error);
                     }
                }
                docRef.delete();
            }
        }
        // Si se edita una tarea
        if (e.target.matches('.edit-btn')) {
            openEditModal({ id: doc.id, ...taskData });
        }
    });

    function resetMarketingForm() {
        mAdType.value = '';
        mContent.value = '';
        referencesContainer.innerHTML = ''; // Limpia los inputs de archivo
    }

    // ... (resto de funciones sin cambios: openEditModal, closeEditModal, saveEditBtn, etc.)
    // ... (lógica de búsqueda y notificaciones sin cambios)

    // --- INICIALIZACIÓN ---
    renderDashboard();
    requestNotificationPermission();

    // --- COPIAR AQUÍ LAS FUNCIONES QUE FALTAN DEL SCRIPT ANTERIOR ---
    // (Asegúrate de que estas funciones estén presentes y completas)
    function openEditModal(task) {
        // ...
    }
    function closeEditModal() {
        // ...
    }
    saveEditBtn.addEventListener('click', () => {
        // ...
    });
    cancelEditBtn.addEventListener('click', closeEditModal);
    backBtn.addEventListener('click', showDashboard);
    filterBar.addEventListener('click', (e) => {
        // ...
    });
    searchBar.addEventListener('input', (e) => {
        // ...
    });
    function requestNotificationPermission() {
        // ...
    }
    function showNotification(body) {
        // ...
    }
});
