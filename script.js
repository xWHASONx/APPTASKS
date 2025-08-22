document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE FIREBASE ---
// ¡¡ASEGÚRATE DE PEGAR AQUÍ LAS CLAVES DE TU PROYECTO 'gestor-tareas-7a86a'!!
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
    const addTaskBtn = document.getElementById('add-task-btn');
    const tNameInput = document.getElementById('tName');
    const tDescInput = document.getElementById('tDesc');
    const tUrgentCheckbox = document.getElementById('tUrgent');
    const backBtn = document.getElementById('back-to-dashboard');
    const filterBar = document.querySelector('.filter-bar');
    // Modal de edición
    const editModal = document.getElementById('edit-modal');
    const editTaskId = document.getElementById('edit-task-id');
    const editTaskName = document.getElementById('edit-task-name');
    const editTaskDesc = document.getElementById('edit-task-desc');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
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
                if (!isFirstLoad) {
                    notificationSound.play().catch(e => {});
                }
                isFirstLoad = false;
                
                const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderTasks(allTasks);
            }, error => console.error("Error al escuchar tareas: ", error));
    }

    // --- RENDERIZADO ---
    function renderTasks(allTasks) {
        taskList.innerHTML = '';
        const filteredTasks = allTasks.filter(task => {
            if (currentFilter === 'pending') return !task.done;
            if (currentFilter === 'completed') return task.done;
            return true;
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `<div class="no-tasks">🎉 No hay tareas en esta vista.</div>`;
            return;
        }

        filteredTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            if (task.done) item.classList.add('done');
            if (task.urgent) item.classList.add('urgent');
            item.dataset.id = task.id;

            const urgentIcon = task.urgent ? `<span class="urgent-icon" title="¡Urgente!">🔥</span>` : '';
            const createdAt = task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : '';

            item.innerHTML = `
                <input type="checkbox" class="toggle-status" ${task.done ? 'checked' : ''}>
                <div class="task-details">
                    <div class="task-name">${task.name}</div>
                    <div class="task-desc">${task.description || ''}</div>
                    <div class="task-meta">
                        <span>${createdAt}</span>
                        ${urgentIcon}
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
    
    // --- DRAG & DROP ---
    new Sortable(taskList, {
        animation: 150,
        handle: '.task-item',
        ghostClass: 'sortable-ghost',
        onEnd: saveOrder
    });

    function saveOrder() {
        const items = taskList.querySelectorAll('.task-item');
        const batch = db.batch();
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        items.forEach((item, index) => {
            const docId = item.dataset.id;
            if (docId) {
                const docRef = db.collection(collectionName).doc(docId);
                batch.update(docRef, { orden: Date.now() - index });
            }
        });
        batch.commit().catch(err => console.error("Error al guardar orden: ", err));
    }

    // --- EVENTOS ---
    addTaskBtn.addEventListener('click', () => {
        const name = tNameInput.value.trim();
        const description = tDescInput.value.trim();
        if (!name) { alert('El nombre de la tarea es obligatorio.'); return; }

        db.collection(`tasks_${currentDepartment.toUpperCase()}`).add({
            name: name,
            description: description,
            done: false,
            urgent: tUrgentCheckbox.checked,
            orden: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tNameInput.value = '';
        tDescInput.value = '';
        tUrgentCheckbox.checked = false;
    });

    taskList.addEventListener('click', async (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        const docRef = db.collection(collectionName).doc(taskId);

        if (e.target.matches('.toggle-status')) {
            const doc = await docRef.get();
            if (doc.exists) docRef.update({ done: !doc.data().done });
        }
        if (e.target.matches('.delete-btn')) {
            if (confirm('¿Eliminar esta tarea?')) docRef.delete();
        }
        if (e.target.matches('.edit-btn')) {
            const doc = await docRef.get();
            if (doc.exists) openEditModal({ id: doc.id, ...doc.data() });
        }
    });

    function openEditModal(task) {
        editTaskId.value = task.id;
        editTaskName.value = task.name;
        editTaskDesc.value = task.description || '';
        editModal.style.display = 'flex';
    }
    function closeEditModal() {
        editModal.style.display = 'none';
    }
    
    saveEditBtn.addEventListener('click', () => {
        const id = editTaskId.value;
        const newName = editTaskName.value.trim();
        const newDesc = editTaskDesc.value.trim();
        if (!newName) { alert('El nombre no puede estar vacío.'); return; }
        
        db.collection(`tasks_${currentDepartment.toUpperCase()}`).doc(id).update({
            name: newName,
            description: newDesc
        });
        closeEditModal();
    });
    cancelEditBtn.addEventListener('click', closeEditModal);

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
