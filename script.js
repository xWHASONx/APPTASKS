document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE FIREBASE ---
    // PEGA AQUÍ TU OBJETO firebaseConfig
    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "tu-proyecto.firebaseapp.com",
        projectId: "tu-proyecto",
        storageBucket: "tu-proyecto.appspot.com",
        messagingSenderId: "...",
        appId: "..."
    };

    // --- INICIALIZACIÓN DE SERVICIOS ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- ESTADO GLOBAL DE LA APP ---
    const departments = { 'TECH': '💻', 'VENTAS': '💰', 'MARKETING': '📈', 'RESERVAS': '📅', 'ADMINISTRATIVA': '🗂️' };
    let currentDepartment = null;
    let currentUser = null;
    let unsubscribe = null;
    const notificationSound = new Audio('notification.mp3');
    let isFirstLoad = true;

    // --- ELEMENTOS DEL DOM ---
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userPhoto = document.getElementById('user-photo');
    const dashboardView = document.getElementById('dashboard-view');
    const tasksView = document.getElementById('tasks-view');
    const departmentsGrid = document.getElementById('departments-grid');
    const taskList = document.getElementById('task-list');
    const departmentTitle = document.getElementById('department-title');
    const addTaskBtn = document.getElementById('add-task-btn');
    const tNameInput = document.getElementById('tName');
    const tUrgentCheckbox = document.getElementById('tUrgent');
    const backBtn = document.getElementById('back-to-dashboard');

    // --- LÓGICA DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = {
                uid: user.uid,
                name: user.displayName,
                photoURL: user.photoURL
            };
            userName.textContent = user.displayName;
            userPhoto.src = user.photoURL;
            userInfo.style.display = 'flex';
            loginBtn.style.display = 'none';
            showDashboard();
        } else {
            currentUser = null;
            userInfo.style.display = 'none';
            loginBtn.style.display = 'block';
            dashboardView.classList.remove('active');
            tasksView.classList.remove('active');
        }
    });

    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => console.error("Error en login:", error));
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    // --- LÓGICA DE NAVEGACIÓN ---
    function showDashboard() {
        dashboardView.classList.add('active');
        tasksView.classList.remove('active');
        if (unsubscribe) unsubscribe();
    }

    function showTasks(department) {
        if (!currentUser) { alert("Debes iniciar sesión para ver las tareas."); return; }
        dashboardView.classList.remove('active');
        tasksView.classList.add('active');
        currentDepartment = department;
        departmentTitle.textContent = department;
        listenForTasks();
    }

    // --- LÓGICA DE DATOS (FIREBASE) ---
    function listenForTasks() {
        if (!currentDepartment || !currentUser) return;
        if (unsubscribe) unsubscribe();
        
        isFirstLoad = true;
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        
        unsubscribe = db.collection(collectionName).orderBy('orden', 'desc')
            .onSnapshot(snapshot => {
                if (!isFirstLoad) {
                    notificationSound.play().catch(e => console.log("El usuario debe interactuar con la página para reproducir sonido."));
                }
                isFirstLoad = false;
                
                const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderTasks(tasks);
            }, error => {
                console.error("Error al escuchar tareas: ", error);
            });
    }

    addTaskBtn.addEventListener('click', () => {
        const name = tNameInput.value.trim();
        const isUrgent = tUrgentCheckbox.checked;
        if (!name) return;

        db.collection(`tasks_${currentDepartment.toUpperCase()}`).add({
            name: name,
            done: false,
            urgent: isUrgent,
            orden: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser
        });
        tNameInput.value = '';
        tUrgentCheckbox.checked = false;
    });

    // --- LÓGICA DE TAREAS INDIVIDUALES (delegación de eventos) ---
    taskList.addEventListener('click', e => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const id = taskItem.dataset.id;
        const collectionName = `tasks_${currentDepartment.toUpperCase()}`;
        const taskDoc = db.collection(collectionName).doc(id);

        if (e.target.matches('.toggle-status')) {
            taskDoc.get().then(doc => {
                if (doc.exists) taskDoc.update({ done: !doc.data().done });
            });
        }
        if (e.target.matches('.delete-btn, .delete-btn *')) { // El * es para el icono dentro del botón
            if (confirm('¿Eliminar esta tarea?')) taskDoc.delete();
        }
        if (e.target.matches('.urgent-btn, .urgent-btn *')) {
             taskDoc.get().then(doc => {
                if (doc.exists) taskDoc.update({ urgent: !doc.data().urgent });
            });
        }
    });

    // --- LÓGICA DE DRAG & DROP ---
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

    new Sortable(taskList, {
        animation: 150,
        handle: '.task-item',
        ghostClass: 'sortable-ghost',
        onEnd: saveOrder
    });

    // --- RENDERIZADO ---
    function renderTasks(tasks) {
        taskList.innerHTML = '';
        if (tasks.length === 0) {
            taskList.innerHTML = '<div class="no-tasks">🎉 No hay tareas pendientes.</div>';
            return;
        }
        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            if (task.done) item.classList.add('done');
            if (task.urgent) item.classList.add('urgent');
            item.dataset.id = task.id;

            const urgentIcon = task.urgent ? '<span class="urgent-icon" title="¡Urgente!">🔥</span>' : '';
            const creatorInfo = task.createdBy ? `<div class="task-creator" title="Creado por ${task.createdBy.name}"><img class="creator-photo" src="${task.createdBy.photoURL}"></div>` : '';

            item.innerHTML = `
                <input type="checkbox" class="toggle-status" ${task.done ? 'checked' : ''}>
                <div class="task-details">
                    <div class="task-name">${task.name}</div>
                    <div class="task-meta">
                        ${creatorInfo}
                        ${urgentIcon}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="urgent-btn" title="Marcar como urgente">🚨</button>
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
            card.dataset.department = name;
            card.innerHTML = `<div class="card-icon">${icon}</div><div class="card-name">${name}</div>`;
            card.addEventListener('click', () => showTasks(name));
            departmentsGrid.appendChild(card);
        }
    }

    // --- EVENTOS GLOBALES Y INICIALIZACIÓN ---
    backBtn.addEventListener('click', showDashboard);
    renderDashboard();
});