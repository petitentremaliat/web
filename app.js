// Configurar pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Elementos de Login/Registro
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const registerEmailInput = document.getElementById('registerEmail');
const registerPasswordInput = document.getElementById('registerPassword');
const registerPasswordConfirmInput = document.getElementById('registerPasswordConfirm');
const authError = document.getElementById('authError');
const authSuccess = document.getElementById('authSuccess');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserEmailSpan = document.getElementById('currentUserEmail');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const adminPanel = document.getElementById('adminPanel');
const adminBadge = document.getElementById('adminBadge');
const closeAdminPanelBtn = document.getElementById('closeAdminPanelBtn');

// Email del administrador (puedes cambiarlo)
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'admin123'; // Contraseña por defecto del admin

// NOTA: La API Key de OpenAI ahora está protegida en el servidor
// Ya no se almacena ni se expone en el código del cliente

// Configuración de API
const API_BASE_URL = window.location.origin; // Usa la misma URL del servidor
let authToken = localStorage.getItem('authToken') || null;
let currentUserData = null;

// Detectar si hay servidor disponible
let useServer = false;
async function checkServer() {
    // En producción (Hostinger), verificar que el servidor esté disponible
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
            // Intentar conectar al servidor usando el endpoint /health (más simple y confiable)
            const response = await fetch(`${API_BASE_URL}/health`, {
                method: 'GET',
                // No incluir Authorization para verificar conectividad básica
            });
            // Si el servidor responde (incluso con error diferente a 503), está disponible
            if (response.status !== 503 && response.status !== 502) {
                useServer = true;
                console.log('✅ Servidor detectado y disponible');
                return true;
            } else {
                // Servidor no disponible (503 Service Unavailable o 502 Bad Gateway)
                console.error('❌ Servidor no disponible (Error 503/502). Verifica que el servidor Node.js esté corriendo en Hostinger.');
                useServer = false;
                return false;
            }
        } catch (error) {
            // Error de conexión (red, CORS, etc.)
            console.error('❌ No se pudo conectar al servidor:', error.message);
            console.error('⚠️ Verifica que el servidor Node.js esté corriendo en Hostinger');
            useServer = false;
            return false;
        }
    }
    
    // Para desarrollo local, verificar si el servidor está disponible
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs`, {
            method: 'GET',
        });
        if (response.status !== 503 && response.status !== 502) {
            useServer = true;
            console.log('✅ Servidor local detectado');
            return true;
        }
    } catch (error) {
        // Ignorar errores en desarrollo local
    }
    
    // Solo usar localStorage en desarrollo local si el servidor no responde
    console.warn('⚠️ Servidor no disponible, usando localStorage (modo desarrollo)');
    useServer = false;
    return false;
}

// Inicializar verificación de servidor
checkServer();

// Funciones de Autenticación con fallback a localStorage
async function saveUser(email, password) {
    if (useServer) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || 'Error al registrar');
            }
        } catch (error) {
            console.error('❌ Error registrando en servidor:', error);
            // En producción (Hostinger), mostrar error en lugar de usar fallback
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                throw new Error('No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.');
            }
            // Solo usar fallback en desarrollo local
            console.warn('⚠️ Usando localStorage como fallback (solo en desarrollo)');
            useServer = false;
        }
    }
    
    // Fallback: guardar en localStorage (solo en desarrollo local)
    if (!useServer) {
        try {
            const users = getAllUsers();
            users[email.toLowerCase()] = password;
            localStorage.setItem('registeredUsers', JSON.stringify(users));
            console.log('✅ Usuario guardado en localStorage:', email);
            return true;
        } catch (e) {
            console.error('Error guardando usuario:', e);
            return false;
        }
    }
    
    return false;
}

function getAllUsers() {
    try {
        const usersStr = localStorage.getItem('registeredUsers');
        return usersStr ? JSON.parse(usersStr) : {};
    } catch (e) {
        console.error('Error obteniendo usuarios:', e);
        return {};
    }
}

function getUser(email) {
    try {
        const users = getAllUsers();
        return users[email.toLowerCase()] || null;
    } catch (e) {
        console.error('Error obteniendo usuario:', e);
        return null;
    }
}

async function verifyUser(email, password) {
    // Re-verificar servidor antes de intentar iniciar sesión
    await checkServer();
    
    if (useServer) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            if (!response.ok) {
                if (response.status === 503 || response.status === 502) {
                    throw new Error('El servidor no está disponible. Por favor, verifica que el servidor Node.js esté corriendo en Hostinger.');
                }
                const errorData = await response.json().catch(() => ({ error: 'Credenciales incorrectas' }));
                throw new Error(errorData.error || 'Credenciales incorrectas');
            }
            
            const data = await response.json();
            if (data.success && data.token) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                currentUserData = {
                    email: data.email,
                    isAdmin: data.isAdmin
                };
                console.log('✅ Usuario autenticado en el servidor:', email);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error verificando en servidor:', error);
            // En producción, mostrar error claro y re-lanzar
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                // Si es un error de red/conexión, proporcionar mensaje más claro
                if (error.message.includes('fetch') || error.message.includes('Failed') || error.message.includes('Network')) {
                    throw new Error('No se pudo conectar al servidor. Por favor, verifica tu conexión a internet o contacta al administrador.');
                }
                throw error; // Re-lanzar el error para que se muestre al usuario
            }
            // Solo usar fallback en desarrollo local
            console.warn('⚠️ Usando localStorage como fallback (solo en desarrollo)');
            useServer = false;
        }
    }
    
    // Fallback: verificar en localStorage (solo en desarrollo local o si servidor no disponible)
    if (!useServer) {
        const savedPassword = getUser(email);
        if (savedPassword === password) {
            setCurrentUser(email);
            console.log('✅ Usuario autenticado en localStorage:', email);
            return true;
        }
        return false;
    }
    
    return false;
}

function getCurrentUser() {
    try {
        if (currentUserData) {
            return currentUserData.email;
        }
        return localStorage.getItem('currentUserEmail');
    } catch (e) {
        console.error('Error obteniendo usuario actual:', e);
        return null;
    }
}

function setCurrentUser(email) {
    try {
        localStorage.setItem('currentUserEmail', email);
        currentUserData = { email, isAdmin: isAdmin(email) };
        return true;
    } catch (e) {
        console.error('Error estableciendo usuario actual:', e);
        return false;
    }
}

function clearCurrentUser() {
    try {
        localStorage.removeItem('currentUserEmail');
        localStorage.removeItem('authToken');
        authToken = null;
        currentUserData = null;
        return true;
    } catch (e) {
        console.error('Error limpiando usuario actual:', e);
        return false;
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
    switchToLoginTab();
}

function isAdmin(email) {
    return email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function initAdminUser() {
    // Crear usuario admin por defecto si no existe
    const users = getAllUsers();
    if (!users[ADMIN_EMAIL.toLowerCase()]) {
        saveUser(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('Usuario administrador creado:', ADMIN_EMAIL);
    }
}

function showMainContent(userEmail) {
    loginScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    if (currentUserEmailSpan) {
        currentUserEmailSpan.textContent = userEmail;
    }
    
    // Verificar si es administrador usando currentUserData o email
    const userIsAdmin = (currentUserData && currentUserData.isAdmin) || isAdmin(userEmail);
    
    // Mostrar opciones de admin SOLO si es administrador
    if (userIsAdmin) {
        if (adminPanelBtn) adminPanelBtn.classList.remove('hidden');
        if (adminBadge) adminBadge.classList.remove('hidden');
    } else {
        // Asegurar que estén ocultos para usuarios normales
        if (adminPanelBtn) {
            adminPanelBtn.classList.add('hidden');
        }
        if (adminBadge) {
            adminBadge.classList.add('hidden');
        }
        // Asegurar que el panel de admin esté cerrado si estaba abierto
        if (adminPanel) {
            adminPanel.classList.add('hidden');
        }
    }
}

function initAuth() {
    // Inicializar usuario admin por defecto
    initAdminUser();
    
    const currentUser = getCurrentUser();
    if (currentUser) {
        showMainContent(currentUser);
    } else {
        showLogin();
    }
}

// Funciones para Historial de PDFs con sincronización
async function savePdfHistory(fileName, transactions, userEmail) {
    // Calcular totales
    const totalIncome = transactions.filter(t => t.importe > 0).reduce((sum, t) => sum + t.importe, 0);
    const totalExpenses = Math.abs(transactions.filter(t => t.importe < 0).reduce((sum, t) => sum + t.importe, 0));
    
    // Calcular balance final
    let finalBalance = null;
    
    // Ordenar transacciones por fecha para obtener la más reciente
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = parseDate(a.fecha);
        const dateB = parseDate(b.fecha);
        return dateB - dateA; // Más reciente primero
    });
    
    // Intentar obtener el saldo de la transacción más reciente
    if (sortedTransactions.length > 0) {
        const lastTransaction = sortedTransactions[0];
        
        // Si la transacción tiene saldo, usarlo
        if (lastTransaction.saldo !== null && lastTransaction.saldo !== undefined) {
            finalBalance = lastTransaction.saldo;
        } else {
            // Si no, buscar el último saldo disponible en cualquier transacción
            for (const t of sortedTransactions) {
                if (t.saldo !== null && t.saldo !== undefined) {
                    finalBalance = t.saldo;
                    break;
                }
            }
            
            // Si no hay saldos, calcular el saldo acumulativo
            if (finalBalance === null) {
                // Ordenar por fecha ascendente para calcular acumulativo
                const sortedAsc = [...transactions].sort((a, b) => {
                    const dateA = parseDate(a.fecha);
                    const dateB = parseDate(b.fecha);
                    return dateA - dateB;
                });
                
                finalBalance = sortedAsc.reduce((sum, t) => sum + t.importe, 0);
            }
        }
    }
    
    // Preparar datos para guardar
    const transactionsData = transactions.map(t => ({
        fecha: t.fecha,
        concepto: t.concepto,
        detalle: t.detalle,
        importe: t.importe,
        tipo: t.tipo,
        categoria: t.categoria || 'Otros',
        saldo: t.saldo
    }));
    
    // Intentar guardar en servidor
    if (useServer && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pdf-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    fileName: fileName,
                    transactions: transactionsData,
                    totalIncome: totalIncome,
                    totalExpenses: totalExpenses,
                    finalBalance: finalBalance
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('Historial guardado en servidor');
                    return true;
                }
            }
        } catch (error) {
            console.error('Error guardando en servidor, usando localStorage:', error);
            useServer = false;
        }
    }
    
    // Fallback: guardar en localStorage
    try {
        const history = getPdfHistory();
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: userEmail.toLowerCase(),
            fileName: fileName,
            transactionCount: transactions.length,
            transactions: transactionsData,
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            finalBalance: finalBalance
        };
        
        history.unshift(entry); // Añadir al inicio
        // Limitar historial a los últimos 1000 PDFs
        if (history.length > 1000) {
            history.splice(1000);
        }
        
        localStorage.setItem('pdfHistory', JSON.stringify(history));
        return true;
    } catch (e) {
        console.error('Error guardando historial:', e);
        return false;
    }
}

function savePdfHistoryLocal(fileName, transactions, userEmail) {
    try {
        const history = getPdfHistory();
        
        // Calcular balance final
        let finalBalance = null;
        
        // Ordenar transacciones por fecha para obtener la más reciente
        const sortedTransactions = [...transactions].sort((a, b) => {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA; // Más reciente primero
        });
        
        // Intentar obtener el saldo de la transacción más reciente
        if (sortedTransactions.length > 0) {
            const lastTransaction = sortedTransactions[0];
            
            // Si la transacción tiene saldo, usarlo
            if (lastTransaction.saldo !== null && lastTransaction.saldo !== undefined) {
                finalBalance = lastTransaction.saldo;
            } else {
                // Si no, buscar el último saldo disponible en cualquier transacción
                for (const t of sortedTransactions) {
                    if (t.saldo !== null && t.saldo !== undefined) {
                        finalBalance = t.saldo;
                        break;
                    }
                }
                
                // Si no hay saldos, calcular el saldo acumulativo
                if (finalBalance === null) {
                    // Ordenar por fecha ascendente para calcular acumulativo
                    const sortedAsc = [...transactions].sort((a, b) => {
                        const dateA = parseDate(a.fecha);
                        const dateB = parseDate(b.fecha);
                        return dateA - dateB;
                    });
                    
                    finalBalance = sortedAsc.reduce((sum, t) => sum + t.importe, 0);
                }
            }
        }
        
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: userEmail.toLowerCase(),
            fileName: fileName,
            transactionCount: transactions.length,
            transactions: transactions.map(t => ({
                fecha: t.fecha,
                concepto: t.concepto,
                detalle: t.detalle,
                importe: t.importe,
                tipo: t.tipo,
                categoria: t.categoria || 'Otros',
                saldo: t.saldo
            })),
            totalIncome: transactions.filter(t => t.importe > 0).reduce((sum, t) => sum + t.importe, 0),
            totalExpenses: Math.abs(transactions.filter(t => t.importe < 0).reduce((sum, t) => sum + t.importe, 0)),
            finalBalance: finalBalance
        };
        
        history.unshift(entry); // Añadir al inicio
        // Limitar historial a los últimos 1000 PDFs
        if (history.length > 1000) {
            history.splice(1000);
        }
        
        localStorage.setItem('pdfHistory', JSON.stringify(history));
        return true;
    } catch (e) {
        console.error('Error guardando historial:', e);
        return false;
    }
}

// Cargar datos del servidor
async function loadServerData() {
    if (!useServer || !authToken) return;
    
    try {
        // Cargar historial de PDFs
        const response = await fetch(`${API_BASE_URL}/api/pdf-history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.history) {
                // Guardar en localStorage como backup
                localStorage.setItem('pdfHistory', JSON.stringify(data.history));
            }
        }
        
        // Cargar clasificaciones aprendidas
        const classificationsResponse = await fetch(`${API_BASE_URL}/api/learned-classifications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (classificationsResponse.ok) {
            const classData = await classificationsResponse.json();
            if (classData.success && classData.classifications) {
                // Guardar en localStorage
                localStorage.setItem('learnedClassifications', JSON.stringify(classData.classifications));
            }
        }
    } catch (error) {
        console.error('Error cargando datos del servidor:', error);
    }
}

async function getPdfHistory() {
    // Si hay servidor y token, intentar obtener del servidor
    if (useServer && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pdf-history`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.history) {
                    // Convertir formato del servidor al formato local
                    return data.history.map(entry => ({
                        id: entry.id,
                        timestamp: entry.timestamp,
                        userEmail: entry.userEmail,
                        fileName: entry.fileName,
                        transactionCount: entry.transactionCount,
                        transactions: [], // Los transactions vienen en formato JSON string
                        totalIncome: entry.totalIncome,
                        totalExpenses: entry.totalExpenses,
                        finalBalance: entry.finalBalance
                    }));
                }
            }
        } catch (error) {
            console.error('Error obteniendo historial del servidor:', error);
            useServer = false;
        }
    }
    
    // Fallback: obtener de localStorage
    try {
        const historyStr = localStorage.getItem('pdfHistory');
        return historyStr ? JSON.parse(historyStr) : [];
    } catch (e) {
        console.error('Error obteniendo historial:', e);
        return [];
    }
}

function clearPdfHistory() {
    try {
        localStorage.removeItem('pdfHistory');
        return true;
    } catch (e) {
        console.error('Error limpiando historial:', e);
        return false;
    }
}

// Funciones del Panel de Administración
async function openAdminPanel() {
    // Verificar que el usuario sea administrador antes de abrir
    const currentUser = getCurrentUser();
    const userIsAdmin = (currentUserData && currentUserData.isAdmin) || isAdmin(currentUser);
    
    if (!userIsAdmin) {
        alert('No tienes permisos para acceder al panel de administración');
        return;
    }
    
    if (adminPanel) {
        adminPanel.classList.remove('hidden');
        await loadAdminStats();
        await loadAdminTable();
    }
}

function closeAdminPanel() {
    if (adminPanel) {
        adminPanel.classList.add('hidden');
    }
}

async function loadAdminStats() {
    // Si hay servidor y es admin, obtener del servidor
    if (useServer && authToken && currentUserData && currentUserData.isAdmin) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.stats) {
                    const stats = data.stats;
                    
                    // Actualizar estadísticas
                    const totalPdfsEl = document.getElementById('adminTotalPdfs');
                    const totalUsersEl = document.getElementById('adminTotalUsers');
                    const totalTransactionsEl = document.getElementById('adminTotalTransactions');
                    const totalIncomeEl = document.getElementById('adminTotalIncome');
                    const totalExpensesEl = document.getElementById('adminTotalExpenses');
                    
                    if (totalPdfsEl) totalPdfsEl.textContent = stats.totalPdfs || 0;
                    if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
                    if (totalTransactionsEl) totalTransactionsEl.textContent = stats.totalTransactions || 0;
                    if (totalIncomeEl) totalIncomeEl.textContent = (stats.totalIncome || 0).toFixed(2) + ' €';
                    if (totalExpensesEl) totalExpensesEl.textContent = (stats.totalExpenses || 0).toFixed(2) + ' €';
                    
                    // Cargar lista de usuarios
                    const usersResponse = await fetch(`${API_BASE_URL}/api/admin/users`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                    
                    if (usersResponse.ok) {
                        const usersData = await usersResponse.json();
                        if (usersData.success && usersData.users) {
                            const userFilter = document.getElementById('adminUserFilter');
                            if (userFilter) {
                                userFilter.innerHTML = '<option value="">Todos los usuarios</option>';
                                usersData.users.forEach(user => {
                                    const option = document.createElement('option');
                                    option.value = user.email;
                                    option.textContent = user.email;
                                    userFilter.appendChild(option);
                                });
                            }
                        }
                    }
                    
                    return;
                }
            }
        } catch (error) {
            console.error('Error cargando estadísticas del servidor:', error);
            useServer = false;
        }
    }
    
    // Fallback: calcular desde localStorage
    const history = await getPdfHistory();
    const users = getAllUsers();
    const userList = Object.keys(users);
    
    let totalTransactions = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    
    history.forEach(entry => {
        totalTransactions += entry.transactionCount || 0;
        totalIncome += entry.totalIncome || 0;
        totalExpenses += entry.totalExpenses || 0;
    });
    
    // Actualizar estadísticas
    const totalPdfsEl = document.getElementById('adminTotalPdfs');
    const totalUsersEl = document.getElementById('adminTotalUsers');
    const totalTransactionsEl = document.getElementById('adminTotalTransactions');
    const totalIncomeEl = document.getElementById('adminTotalIncome');
    const totalExpensesEl = document.getElementById('adminTotalExpenses');
    
    if (totalPdfsEl) totalPdfsEl.textContent = history.length;
    if (totalUsersEl) totalUsersEl.textContent = userList.length;
    if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions;
    if (totalIncomeEl) totalIncomeEl.textContent = totalIncome.toFixed(2) + ' €';
    if (totalExpensesEl) totalExpensesEl.textContent = totalExpenses.toFixed(2) + ' €';
    
    // Cargar filtro de usuarios
    const userFilter = document.getElementById('adminUserFilter');
    if (userFilter) {
        userFilter.innerHTML = '<option value="">Todos los usuarios</option>';
        userList.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            userFilter.appendChild(option);
        });
    }
}

async function loadAdminTable(filterUser = '', searchText = '') {
    let history = [];
    
    // Si hay servidor y es admin, obtener del servidor
    if (useServer && authToken && currentUserData && currentUserData.isAdmin) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/pdf-history`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.history) {
                    history = data.history;
                }
            }
        } catch (error) {
            console.error('Error cargando tabla del servidor:', error);
            useServer = false;
            history = await getPdfHistory();
        }
    } else {
        history = await getPdfHistory();
    }
    const tableBody = document.getElementById('adminTableBody');
    
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    let filteredHistory = history;
    
    // Filtrar por usuario
    if (filterUser) {
        filteredHistory = filteredHistory.filter(entry => 
            entry.userEmail.toLowerCase() === filterUser.toLowerCase()
        );
    }
    
    // Filtrar por búsqueda
    if (searchText) {
        const search = searchText.toLowerCase();
        filteredHistory = filteredHistory.filter(entry =>
            entry.userEmail.toLowerCase().includes(search) ||
            entry.fileName.toLowerCase().includes(search)
        );
    }
    
    if (filteredHistory.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center; padding: 40px; color: #718096;">No hay PDFs procesados aún</td>';
        tableBody.appendChild(row);
        return;
    }
    
    filteredHistory.forEach(entry => {
        const row = document.createElement('tr');
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const balanceDisplay = entry.finalBalance !== null && entry.finalBalance !== undefined 
            ? `<td class="${entry.finalBalance >= 0 ? 'income' : 'expense'}">${entry.finalBalance.toFixed(2)} €</td>`
            : '<td style="color: #718096;">N/A</td>';
        
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${entry.userEmail}</td>
            <td>${entry.fileName}</td>
            <td>${entry.transactionCount}</td>
            <td class="income">${entry.totalIncome.toFixed(2)} €</td>
            <td class="expense">${entry.totalExpenses.toFixed(2)} €</td>
            ${balanceDisplay}
            <td>
                <button class="btn btn-small btn-secondary view-details-btn" data-id="${entry.id}">
                    Ver Detalles
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Añadir event listeners a los botones de detalles
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (id) {
                await showPdfDetails(id);
            }
        });
    });
}

async function showPdfDetails(id) {
    let entry = null;
    
    // Intentar obtener del servidor si es admin o el usuario actual
    if (useServer && authToken) {
        try {
            const endpoint = currentUserData && currentUserData.isAdmin 
                ? `/api/admin/pdf-history/${id}` 
                : `/api/pdf-history/${id}`;
                
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.pdf) {
                    const pdf = data.pdf;
                    entry = {
                        id: pdf.id,
                        timestamp: pdf.timestamp,
                        userEmail: pdf.userEmail,
                        fileName: pdf.fileName,
                        transactionCount: pdf.transactionCount,
                        transactions: pdf.transactions,
                        totalIncome: pdf.totalIncome,
                        totalExpenses: pdf.totalExpenses,
                        finalBalance: pdf.finalBalance
                    };
                }
            }
        } catch (error) {
            console.error('Error obteniendo detalles del servidor:', error);
        }
    }
    
    // Si no se obtuvo del servidor, buscar en localStorage
    if (!entry) {
        const history = await getPdfHistory();
        entry = history.find(e => e.id === parseInt(id));
        
        // Si el entry tiene transactions como JSON string, parsearlo
        if (entry && typeof entry.transactions === 'string') {
            try {
                entry.transactions = JSON.parse(entry.transactions);
            } catch (e) {
                console.error('Error parseando transactions:', e);
                entry.transactions = [];
            }
        }
    }
    
    if (!entry) {
        alert('PDF no encontrado');
        return;
    }
    
    // Asegurar que transactions sea un array
    const transactions = Array.isArray(entry.transactions) ? entry.transactions : [];
    
    // Crear modal con detalles
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Detalles del PDF: ${entry.fileName}</h3>
                <button class="modal-close-btn">×</button>
            </div>
            <div class="modal-body">
                <p><strong>Usuario:</strong> ${entry.userEmail}</p>
                <p><strong>Fecha/Hora:</strong> ${new Date(entry.timestamp).toLocaleString('es-ES')}</p>
                <p><strong>Total Transacciones:</strong> ${entry.transactionCount}</p>
                <p><strong>Total Ingresos:</strong> <span class="income">${(entry.totalIncome || 0).toFixed(2)} €</span></p>
                <p><strong>Total Gastos:</strong> <span class="expense">${(entry.totalExpenses || 0).toFixed(2)} €</span></p>
                <p><strong>Balance Final:</strong> <span class="${entry.finalBalance !== null && entry.finalBalance !== undefined ? (entry.finalBalance >= 0 ? 'income' : 'expense') : ''}">${entry.finalBalance !== null && entry.finalBalance !== undefined ? entry.finalBalance.toFixed(2) + ' €' : 'N/A'}</span></p>
                <h4>Transacciones:</h4>
                <div class="modal-table-container">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Concepto</th>
                                <th>Detalle</th>
                                <th>Importe</th>
                                <th>Tipo</th>
                                <th>Categoría</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.length > 0 ? transactions.map(t => `
                                <tr>
                                    <td>${t.fecha || 'N/A'}</td>
                                    <td>${t.concepto || 'N/A'}</td>
                                    <td>${t.detalle || 'N/A'}</td>
                                    <td class="${t.importe >= 0 ? 'income' : 'expense'}">${t.importe >= 0 ? '+' : ''}${(t.importe || 0).toFixed(2)} €</td>
                                    <td>${t.tipo || 'N/A'}</td>
                                    <td>${t.categoria || 'Otros'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay transacciones disponibles</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal
    modal.querySelector('.modal-close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Event Listeners para Panel de Admin
if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
        // Verificar que el usuario sea administrador antes de abrir el panel
        const currentUser = getCurrentUser();
        const userIsAdmin = (currentUserData && currentUserData.isAdmin) || isAdmin(currentUser);
        
        if (userIsAdmin) {
            openAdminPanel();
        } else {
            alert('No tienes permisos para acceder al panel de administración');
        }
    });
}

if (closeAdminPanelBtn) {
    closeAdminPanelBtn.addEventListener('click', () => {
        closeAdminPanel();
    });
}

// Filtros del panel de admin
const adminSearchInput = document.getElementById('adminSearchInput');
const adminUserFilter = document.getElementById('adminUserFilter');

if (adminSearchInput) {
    adminSearchInput.addEventListener('input', async (e) => {
        const searchText = e.target.value;
        const filterUser = adminUserFilter ? adminUserFilter.value : '';
        await loadAdminTable(filterUser, searchText);
    });
}

if (adminUserFilter) {
    adminUserFilter.addEventListener('change', async (e) => {
        const filterUser = e.target.value;
        const searchText = adminSearchInput ? adminSearchInput.value : '';
        await loadAdminTable(filterUser, searchText);
    });
}

function switchToLoginTab() {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginFormContainer.classList.remove('hidden');
    registerFormContainer.classList.add('hidden');
    hideAuthMessages();
    // Limpiar formularios
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
}

function switchToRegisterTab() {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerFormContainer.classList.remove('hidden');
    loginFormContainer.classList.add('hidden');
    hideAuthMessages();
    // Limpiar formularios
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
}

// Manejar cambio de tabs
if (loginTab) {
    loginTab.addEventListener('click', switchToLoginTab);
}

if (registerTab) {
    registerTab.addEventListener('click', switchToRegisterTab);
}

// Manejar formulario de login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        
        const email = loginEmailInput.value.trim().toLowerCase();
        const password = loginPasswordInput.value;
        
        // Validar email
        if (!email) {
            showAuthError('Por favor, ingresa un correo electrónico');
            return;
        }
        
        if (!validateEmail(email)) {
            showAuthError('Por favor, ingresa un correo electrónico válido');
            return;
        }
        
        // Validar contraseña
        if (!password) {
            showAuthError('Por favor, ingresa tu contraseña');
            return;
        }
        
        // Verificar credenciales
        try {
            const isValid = await verifyUser(email, password);
            if (isValid) {
                const userEmail = currentUserData ? currentUserData.email : email;
                const userIsAdmin = (currentUserData && currentUserData.isAdmin) || isAdmin(userEmail);
                
                // Actualizar currentUserData con el estado de admin
                if (!currentUserData) {
                    currentUserData = { email: userEmail, isAdmin: userIsAdmin };
                } else {
                    currentUserData.isAdmin = userIsAdmin;
                }
                
                setCurrentUser(userEmail);
                showMainContent(userEmail);
                loginForm.reset();
                
                // Cargar datos del servidor si está disponible
                if (useServer) {
                    await loadServerData();
                }
            } else {
                showAuthError('Correo electrónico o contraseña incorrectos');
            }
        } catch (error) {
            console.error('Error en login:', error);
            // Mostrar el mensaje de error específico del servidor
            const errorMessage = error.message || 'Error al iniciar sesión. Por favor, intenta de nuevo.';
            showAuthError(errorMessage);
        }
    });
}

// Manejar formulario de registro
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        
        const email = registerEmailInput.value.trim().toLowerCase();
        const password = registerPasswordInput.value;
        const passwordConfirm = registerPasswordConfirmInput.value;
        
        // Validar email
        if (!email) {
            showAuthError('Por favor, ingresa un correo electrónico');
            return;
        }
        
        if (!validateEmail(email)) {
            showAuthError('Por favor, ingresa un correo electrónico válido');
            return;
        }
        
        // Verificar si el usuario ya existe (solo en localStorage como fallback)
        if (!useServer && getUser(email)) {
            showAuthError('Este correo electrónico ya está registrado. Por favor, inicia sesión.');
            return;
        }
        
        // Validar contraseña
        if (!password) {
            showAuthError('Por favor, ingresa una contraseña');
            return;
        }
        
        if (password.length < 6) {
            showAuthError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        
        // Validar confirmación de contraseña
        if (password !== passwordConfirm) {
            showAuthError('Las contraseñas no coinciden');
            return;
        }
        
        // Guardar usuario
        const saved = await saveUser(email, password);
        if (saved) {
            showAuthSuccess('Registro exitoso! Redirigiendo...');
            
            // Si usamos servidor, hacer login automático
            if (useServer) {
                const isValid = await verifyUser(email, password);
                if (isValid) {
                    const userEmail = currentUserData ? currentUserData.email : email;
                    setCurrentUser(userEmail);
                    setTimeout(() => {
                        showMainContent(userEmail);
                        registerForm.reset();
                        loadServerData();
                    }, 1000);
                } else {
                    setTimeout(() => {
                        setCurrentUser(email);
                        showMainContent(email);
                        registerForm.reset();
                    }, 1000);
                }
            } else {
                setTimeout(() => {
                    setCurrentUser(email);
                    showMainContent(email);
                    registerForm.reset();
                }, 1000);
            }
        } else {
            showAuthError('Error al guardar el usuario. Intenta de nuevo.');
        }
    });
}

// Manejar botón de cerrar sesión
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            clearCurrentUser();
            showLogin();
            // Limpiar datos de la sesión
            transactions = [];
            if (expensesChart) expensesChart.destroy();
            if (expensesTimeChart) expensesTimeChart.destroy();
            if (balanceTimeChart) balanceTimeChart.destroy();
            if (sankeyChart) sankeyChart = null;
            if (results) results.classList.add('hidden');
            if (error) error.classList.add('hidden');
        }
    });
}

function showAuthError(message) {
    if (authError) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }
    if (authSuccess) {
        authSuccess.classList.add('hidden');
    }
}

function showAuthSuccess(message) {
    if (authSuccess) {
        authSuccess.textContent = message;
        authSuccess.classList.remove('hidden');
    }
    if (authError) {
        authError.classList.add('hidden');
    }
}

function hideAuthMessages() {
    if (authError) {
        authError.classList.add('hidden');
        authError.textContent = '';
    }
    if (authSuccess) {
        authSuccess.classList.add('hidden');
        authSuccess.textContent = '';
    }
}

// Inicializar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

const pdfInput = document.getElementById('pdfInput');
const uploadBox = document.getElementById('uploadBox');
const fileName = document.getElementById('fileName');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const transactionsBody = document.getElementById('transactionsBody');
const totalTransactions = document.getElementById('totalTransactions');
const totalIncome = document.getElementById('totalIncome');
const totalExpenses = document.getElementById('totalExpenses');
const exportBtn = document.getElementById('exportBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const clearBtn = document.getElementById('clearBtn');
const clearLearnedBtn = document.getElementById('clearLearnedBtn');
const debug = document.getElementById('debug');
const toggleDebug = document.getElementById('toggleDebug');
const debugContent = document.getElementById('debugContent');
const debugText = document.getElementById('debugText');
const debugLines = document.getElementById('debugLines');
const debugDates = document.getElementById('debugDates');
const debugAmounts = document.getElementById('debugAmounts');
const openaiApiKeyInput = document.getElementById('openaiApiKey');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const classifyWithAIBtn = document.getElementById('classifyWithAIBtn');
const aiStatus = document.getElementById('aiStatus');

let transactions = [];
let extractedText = '';
let expensesChart = null;
let expensesTimeChart = null;
let balanceTimeChart = null;
let sankeyChart = null;

// Lista de categorías disponibles
const CATEGORIAS = [
    'Restauración', 'Salud', 'Moda', 'Ocio', 'Transporte', 
    'Deporte', 'Supermercado', 'Servicios', 'Educación', 
    'Bancario', 'Tecnología', 'Hogar', 'Belleza', 
    'Salario', 'Devolución', 'Ingreso', 'Otros'
];

// Sistema de aprendizaje: cargar clasificaciones guardadas
function loadLearnedClassifications() {
    try {
        const saved = localStorage.getItem('learnedClassifications');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error('Error cargando clasificaciones:', e);
        return {};
    }
}

// Sistema de aprendizaje: guardar clasificación
async function saveClassification(detalle, concepto, categoria) {
    const searchText = ((detalle || '') + ' ' + (concepto || '')).toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Intentar guardar en servidor
    if (useServer && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/learned-classification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    searchText: searchText,
                    category: categoria
                })
            });
            
            if (response.ok) {
                console.log('Clasificación guardada en servidor:', searchText, '->', categoria);
                // También guardar en localStorage como backup
                try {
                    const learned = loadLearnedClassifications();
                    learned[searchText] = categoria;
                    localStorage.setItem('learnedClassifications', JSON.stringify(learned));
                } catch (e) {
                    console.error('Error guardando en localStorage:', e);
                }
                return;
            }
        } catch (error) {
            console.error('Error guardando en servidor, usando localStorage:', error);
            useServer = false;
        }
    }
    
    // Fallback: guardar en localStorage
    try {
        const learned = loadLearnedClassifications();
        learned[searchText] = categoria;
        localStorage.setItem('learnedClassifications', JSON.stringify(learned));
        console.log('Clasificación guardada localmente:', searchText, '->', categoria);
    } catch (e) {
        console.error('Error guardando clasificación:', e);
    }
}

// Buscar clasificación aprendida para una transacción
function findLearnedClassification(detalle, concepto) {
    const learned = loadLearnedClassifications();
    if (Object.keys(learned).length === 0) return null;
    
    const searchText = ((detalle || '') + ' ' + (concepto || '')).toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (learned[searchText]) {
        return learned[searchText];
    }
    
    let bestMatch = null;
    let bestMatchLength = 0;
    
    for (const key in learned) {
        if (searchText.includes(key) || key.includes(searchText)) {
            if (key.length > bestMatchLength && key.length >= 5) {
                bestMatch = learned[key];
                bestMatchLength = key.length;
            }
        }
    }
    
    return bestMatch;
}

// Toggle debug view
toggleDebug.addEventListener('click', () => {
    debugContent.classList.toggle('hidden');
});

// No necesitamos manejar click en uploadBox porque el label ya lo hace automáticamente
// gracias al atributo "for" que está enlazado al input

// Manejar drag and drop
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    } else {
        showError('Por favor, selecciona un archivo PDF válido');
    }
});

// Manejar selección de archivo
let isProcessing = false;
pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && !isProcessing) {
        isProcessing = true;
        try {
            await handleFile(file);
        } finally {
            // Resetear el input para permitir seleccionar el mismo archivo de nuevo
            e.target.value = '';
            isProcessing = false;
        }
    }
});

// Procesar el archivo PDF
async function handleFile(file) {
    hideError();
    fileName.textContent = `📄 ${file.name}`;
    loading.classList.remove('hidden');
    results.classList.add('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        let textItems = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            textItems.push(...textContent.items);
            
            let pageText = '';
            let lastY = null;
            
            for (const item of textContent.items) {
                const currentY = Math.round(item.transform[5]);
                
                if (lastY !== null && Math.abs(currentY - lastY) > 3) {
                    pageText += '\n';
                }
                
                pageText += item.str;
                
                if (!item.hasEOL) {
                    pageText += ' ';
                }
                
                lastY = currentY;
            }
            
            fullText += pageText + '\n\n';
        }

        extractedText = fullText;
        
        debug.classList.remove('hidden');
        debugText.textContent = fullText.substring(0, 3000) + (fullText.length > 3000 ? '\n...' : '');
        
        const lines = fullText.split(/\n/).filter(l => l.trim().length > 0);
        debugLines.textContent = lines.length;
        
        const dateMatches = fullText.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
        const amountMatches = fullText.match(/-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?\s*EUR/gi) || [];
        debugDates.textContent = dateMatches.length + ' (' + (dateMatches.length > 0 ? dateMatches.slice(0, 5).join(', ') + '...' : 'ninguna') + ')';
        debugAmounts.textContent = amountMatches.length + ' (' + (amountMatches.length > 0 ? amountMatches.slice(0, 5).join(', ') + '...' : 'ninguno') + ')';
        
        console.log('Texto extraído (primeros 2000 caracteres):', fullText.substring(0, 2000));

        // Primero intentar detectar formato Santander
        transactions = extractSantander(fullText, lines);
        console.log('Transacciones encontradas (método 0 - Santander):', transactions.length);
        
        // Si no es Santander, intentar MyAndBank
        if (transactions.length === 0) {
            transactions = extractMyAndBank(fullText, lines);
            console.log('Transacciones encontradas (método 1 - MyAndBank):', transactions.length);
        }
        
        // Si no es MyAndBank, intentar Crédit Andorrà
        if (transactions.length === 0) {
            transactions = extractCreditAndorra(fullText, lines);
            console.log('Transacciones encontradas (método 1 - Crédit Andorrà):', transactions.length);
        }
        
        if (transactions.length === 0) {
            // Intentar detectar formato específico
            let extracted = null;
            
            // MyAndBank
            if (!extracted) {
                extracted = extractMyAndBank(fullText, lines);
                if (extracted && extracted.length > 0) {
                    transactions = extracted;
                    console.log('Formato MyAndBank detectado');
                }
            }
            
            // Santander
            if (!extracted || extracted.length === 0) {
                extracted = extractSantander(fullText, lines);
                if (extracted && extracted.length > 0) {
                    transactions = extracted;
                    console.log('Formato Santander detectado');
                }
            }
            
            // Crédit Andorrà
            if (!extracted || extracted.length === 0) {
                extracted = extractCreditAndorra(fullText, lines);
                if (extracted && extracted.length > 0) {
                    transactions = extracted;
                    console.log('Formato Crédit Andorrà detectado');
                }
            }
            
            // Método principal (MORABANC y otros)
            if (!extracted || extracted.length === 0) {
                transactions = extractTransactions(fullText);
                console.log('Usando método principal de extracción');
            }
            console.log('Transacciones encontradas (método 1):', transactions.length);
        }
        
        if (transactions.length === 0) {
            transactions = extractTransactionsAlternative(textItems);
            console.log('Transacciones encontradas (método 2):', transactions.length);
        }
        
        if (transactions.length === 0) {
            transactions = extractTransactionsAggressive(fullText);
            console.log('Transacciones encontradas (método 3):', transactions.length);
        }
        
        if (transactions.length === 0) {
            transactions = extractTransactionsMultiline(lines);
            console.log('Transacciones encontradas (método 4 - multilínea):', transactions.length);
        }
        
        if (transactions.length === 0) {
            transactions = extractTransactionsFlexible(lines);
            console.log('Transacciones encontradas (método 5):', transactions.length);
        }
        
        if (transactions.length === 0) {
            showError('No se pudieron extraer transacciones del PDF. El formato puede no ser compatible. Usa el botón "Mostrar/Ocultar Texto Extraído" abajo para ver qué texto se extrajo del PDF.');
            loading.classList.add('hidden');
            return;
        }

        // Filtrar todas las transacciones con importe 0€ (aplicable a todos los formatos)
        transactions = transactions.filter(t => {
            if (t.importe === null || t.importe === undefined) return false;
            return Math.abs(t.importe) > 0.001;
        });

        if (transactions.length === 0) {
            showError('No se encontraron transacciones válidas en el PDF (todas tienen importe 0€).');
            loading.classList.add('hidden');
            return;
        }

        try {
            displayTransactions(transactions);
            
            // Guardar en historial para administrador
            const currentUser = getCurrentUser();
            if (currentUser) {
                await savePdfHistory(file.name, transactions, currentUser);
            }
        } catch (displayError) {
            console.error('Error mostrando transacciones:', displayError);
            showError('Error al mostrar las transacciones: ' + displayError.message);
            loading.classList.add('hidden');
            return;
        }
        
        loading.classList.add('hidden');
        results.classList.remove('hidden');
        
    } catch (err) {
        console.error('Error procesando PDF:', err);
        showError('Error al procesar el PDF: ' + err.message);
        loading.classList.add('hidden');
    }
}

// Extraer transacciones del texto del PDF - Formato Crédit Andorrà
// Extraer transacciones del texto del PDF - Formato Santander
function extractSantander(text, lines) {
    const transactions = [];
    
    // Detectar si es formato Santander
    const isSantander = text.includes('Santander') || 
                       text.includes('Moviments del teu compte') ||
                       text.includes('Moviments del cuenta') ||
                       (text.includes('Data operació') && text.includes('Operació') && 
                        text.includes('Import') && text.includes('Saldo'));
    
    if (!isSantander) {
        return [];
    }
    
    console.log('Detectado formato Santander');
    
    // Mapeo de meses en catalán/español a números
    const mesesMap = {
        'gen': '01', 'gener': '01', 'ene': '01', 'enero': '01',
        'febr': '02', 'febrer': '02', 'feb': '02', 'febrero': '02',
        'març': '03', 'marz': '03', 'mar': '03', 'marzo': '03',
        'abr': '04', 'abril': '04',
        'maig': '05', 'may': '05', 'mayo': '05',
        'juny': '06', 'jun': '06', 'junio': '06',
        'jul': '07', 'juliol': '07', 'julio': '07',
        'ag': '08', 'agost': '08', 'ago': '08', 'agosto': '08',
        'set': '09', 'setembre': '09', 'sep': '09', 'septiembre': '09',
        'oct': '10', 'octubre': '10',
        'nov': '11', 'novembre': '11', 'noviembre': '11',
        'des': '12', 'desembre': '12', 'dic': '12', 'diciembre': '12'
    };
    
    // Función para parsear fecha en formato "26 de des. 2025" o "27 d'oct. 2025"
    function parseSantanderDate(dateStr) {
        try {
            // Normalizar "d'" a "de " para facilitar el parseo
            const normalized = dateStr.replace(/d'/gi, 'de ');
            // Buscar patrones como "26 de des. 2025" o "27 de oct. 2025"
            const datePattern = /(\d{1,2})\s+de\s+([a-z]+)\.?\s+(\d{4})/i;
            const match = normalized.match(datePattern);
            
            if (match) {
                const dia = match[1].padStart(2, '0');
                const mesNombre = match[2].toLowerCase();
                const año = match[3];
                
                const mes = mesesMap[mesNombre];
                if (mes) {
                    return `${dia}/${mes}/${año}`;
                }
            }
        } catch (e) {
            console.error('Error parseando fecha Santander:', dateStr, e);
        }
        return null;
    }
    
    let inTable = false;
    let headerFound = false;
    
    // Reconstruir transacciones multilínea
    let currentTransaction = {
        fecha: null,
        fechaValor: null,
        operacion: [],
        importe: null,
        saldo: null
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Detectar encabezado de tabla
        if ((line.includes('Data operació') || line.includes('Data operaci')) && 
            (line.includes('Import') || line.includes('Saldo'))) {
            inTable = true;
            headerFound = true;
            // Guardar transacción anterior si existe
            if (currentTransaction.fecha && currentTransaction.importe !== null) {
                const operacionStr = currentTransaction.operacion.join(' ').trim();
                if (operacionStr) {
                    let concepto = 'Transacción';
                    const lowerOp = operacionStr.toLowerCase();
                    if (lowerOp.includes('compra')) {
                        concepto = 'Compra';
                    } else if (lowerOp.includes('bizum')) {
                        concepto = 'Bizum';
                    } else if (lowerOp.includes('transferencia')) {
                        concepto = 'Transferencia';
                    } else if (lowerOp.includes('recibo')) {
                        concepto = 'Recibo';
                    } else if (lowerOp.includes('reintegro')) {
                        concepto = 'Reintegro';
                    }
                    
                    transactions.push({
                        fecha: currentTransaction.fecha,
                        concepto: concepto,
                        detalle: operacionStr,
                        importe: currentTransaction.importe,
                        tipo: currentTransaction.importe >= 0 ? 'ingreso' : 'gasto',
                        saldo: currentTransaction.saldo
                    });
                }
            }
            currentTransaction = { fecha: null, fechaValor: null, operacion: [], importe: null, saldo: null };
            continue;
        }
        
        // Detectar fin de tabla
        if (inTable && (line.includes('Document a data') || 
                       line.includes('Per a cerques genèriques') ||
                       line.includes('P à gina') ||
                       line.includes('Página'))) {
            // Guardar última transacción
            if (currentTransaction.fecha && currentTransaction.importe !== null) {
                const operacionStr = currentTransaction.operacion.join(' ').trim();
                if (operacionStr) {
                    let concepto = 'Transacción';
                    const lowerOp = operacionStr.toLowerCase();
                    if (lowerOp.includes('compra')) {
                        concepto = 'Compra';
                    } else if (lowerOp.includes('bizum')) {
                        concepto = 'Bizum';
                    } else if (lowerOp.includes('transferencia')) {
                        concepto = 'Transferencia';
                    } else if (lowerOp.includes('recibo')) {
                        concepto = 'Recibo';
                    } else if (lowerOp.includes('reintegro')) {
                        concepto = 'Reintegro';
                    }
                    
                    transactions.push({
                        fecha: currentTransaction.fecha,
                        concepto: concepto,
                        detalle: operacionStr,
                        importe: currentTransaction.importe,
                        tipo: currentTransaction.importe >= 0 ? 'ingreso' : 'gasto',
                        saldo: currentTransaction.saldo
                    });
                }
            }
            currentTransaction = { fecha: null, fechaValor: null, operacion: [], importe: null, saldo: null };
            inTable = false;
            continue;
        }
        
        if (!inTable || !headerFound) continue;
        
        // Detectar fecha (formato: "26 de des. 2025" o "27 d'oct. 2025")
        const fechaMatch = line.match(/(\d{1,2}\s+(?:de|d')\s+[a-z]+\.?\s+\d{4})/i);
        if (fechaMatch) {
            // Si hay una transacción previa, guardarla
            if (currentTransaction.fecha && currentTransaction.importe !== null) {
                const operacionStr = currentTransaction.operacion.join(' ').trim();
                if (operacionStr) {
                    let concepto = 'Transacción';
                    const lowerOp = operacionStr.toLowerCase();
                    if (lowerOp.includes('compra')) {
                        concepto = 'Compra';
                    } else if (lowerOp.includes('bizum')) {
                        concepto = 'Bizum';
                    } else if (lowerOp.includes('transferencia')) {
                        concepto = 'Transferencia';
                    } else if (lowerOp.includes('recibo')) {
                        concepto = 'Recibo';
                    } else if (lowerOp.includes('reintegro')) {
                        concepto = 'Reintegro';
                    }
                    
                    transactions.push({
                        fecha: currentTransaction.fecha,
                        concepto: concepto,
                        detalle: operacionStr,
                        importe: currentTransaction.importe,
                        tipo: currentTransaction.importe >= 0 ? 'ingreso' : 'gasto',
                        saldo: currentTransaction.saldo
                    });
                }
            }
            // Iniciar nueva transacción
            const fechaStr = fechaMatch[1].replace(/d'/g, 'de '); // Normalizar "d'oct" a "de oct"
            currentTransaction = {
                fecha: parseSantanderDate(fechaStr),
                fechaValor: null,
                operacion: [],
                importe: null,
                saldo: null
            };
            continue;
        }
        
        // Detectar fecha de valor (formato: "D. valor: 23 de des. 2025")
        const fechaValorMatch = line.match(/D\.\s*valor:\s*(\d{1,2}\s+(?:de|d')\s+[a-z]+\.?\s+\d{4})/i);
        if (fechaValorMatch && currentTransaction.fecha) {
            const fechaValorStr = fechaValorMatch[1].replace(/d'/g, 'de ');
            currentTransaction.fechaValor = parseSantanderDate(fechaValorStr);
            continue;
        }
        
        // Si ya tenemos fecha, procesar el resto
        if (currentTransaction.fecha) {
            // Buscar importe y saldo en la línea (formato: "-13,99 €   12,62 €")
            const amounts = line.match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/g);
            if (amounts && amounts.length >= 1) {
                // El primer número es el importe
                const importeMatch = amounts[0].match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
                if (importeMatch) {
                    const importeNum = parseFloat(importeMatch[1].replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(importeNum) && importeNum !== 0) {
                        currentTransaction.importe = importeNum;
                    }
                }
                
                // El segundo número (si existe) es el saldo
                if (amounts.length >= 2) {
                    const saldoMatch = amounts[1].match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
                    if (saldoMatch) {
                        const saldoNum = parseFloat(saldoMatch[1].replace(/\./g, '').replace(',', '.'));
                        if (!isNaN(saldoNum)) {
                            currentTransaction.saldo = saldoNum;
                        }
                    }
                }
                
                // Remover importes de la línea para obtener la operación
                let operacion = line;
                operacion = operacion.replace(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/g, '').trim();
                if (operacion.length > 3) {
                    currentTransaction.operacion.push(operacion);
                }
            } else {
                // Si no hay importes, es parte de la descripción de la operación
                // Pero solo si no es la fecha de valor
                if (line.length > 3 && !line.includes('D. valor:') && !line.match(/(\d{1,2}\s+(?:de|d')\s+[a-z]+\.?\s+\d{4})/i)) {
                    currentTransaction.operacion.push(line);
                }
            }
        }
    }
    
    // Guardar última transacción
    if (currentTransaction.fecha && currentTransaction.importe !== null) {
        const operacionStr = currentTransaction.operacion.join(' ').trim();
        if (operacionStr) {
            let concepto = 'Transacción';
            const lowerOp = operacionStr.toLowerCase();
            if (lowerOp.includes('compra')) {
                concepto = 'Compra';
            } else if (lowerOp.includes('bizum')) {
                concepto = 'Bizum';
            } else if (lowerOp.includes('transferencia')) {
                concepto = 'Transferencia';
            } else if (lowerOp.includes('recibo')) {
                concepto = 'Recibo';
            } else if (lowerOp.includes('reintegro')) {
                concepto = 'Reintegro';
            }
            
            transactions.push({
                fecha: currentTransaction.fecha,
                concepto: concepto,
                detalle: operacionStr,
                importe: currentTransaction.importe,
                tipo: currentTransaction.importe >= 0 ? 'ingreso' : 'gasto',
                saldo: currentTransaction.saldo
            });
        }
    }
    
    // Filtrar transacciones con importe 0
    const filteredTransactions = transactions.filter(t => t.importe !== null && Math.abs(t.importe) > 0.001);
    
    // Ordenar por fecha descendente
    filteredTransactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return filteredTransactions;
}

// Extraer transacciones del texto del PDF - Formato MyAndBank
function extractMyAndBank(text, lines) {
    const transactions = [];
    
    // Detectar si es formato MyAndBank (normalizar espacios para detectar encabezados con espacios extraños)
    const normalizedText = text.replace(/\s+/g, ' ');
    const isMyAndBank = text.toLowerCase().includes('myandbank') ||
                       text.includes('ANDORRA BANC AGRÍCOL REIG') ||
                       text.includes('ANDORRA BANC') ||
                       (normalizedText.includes('Data operació') || normalizedText.includes('Data operaci ó')) &&
                       (normalizedText.includes('Operació') || normalizedText.includes('Operaci ó')) &&
                       normalizedText.includes('Concepte') && 
                       normalizedText.includes('Import') && 
                       normalizedText.includes('Saldo') && 
                       text.match(/\d{4}-\d{2}-\d{2}/);
    
    if (!isMyAndBank) {
        return [];
    }
    
    console.log('Detectado formato MyAndBank');
    
    // Buscar el encabezado - puede estar dividido en múltiples líneas
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        
        // Combinar líneas adyacentes para buscar el encabezado completo
        const combined = (prevLine + ' ' + line + ' ' + nextLine).toLowerCase().replace(/\s+/g, ' ');
        
        if ((combined.includes('data operació') || combined.includes('data operaci ó')) && 
            combined.includes('data valor') && 
            combined.includes('concepte') && 
            (combined.includes('operació') || combined.includes('operaci ó')) && 
            combined.includes('import') && 
            combined.includes('saldo')) {
            headerLineIndex = i;
            console.log('Encabezado encontrado en línea:', i);
            break;
        }
    }
    
    if (headerLineIndex === -1) {
        console.log('No se encontró el encabezado de la tabla');
        // Intentar sin encabezado, buscar directamente líneas con fechas YYYY-MM-DD
        console.log('Intentando extraer sin encabezado...');
    }
    
    // Procesar líneas después del encabezado (o todas las líneas si no hay encabezado)
    const startIndex = headerLineIndex >= 0 ? headerLineIndex + 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Detectar fin de tabla (información legal o final del documento)
        if (line.includes('ANDORRA BANC AGRÍCOL REIG') && line.length > 100 ||
            line.includes('NRT A-') || line.includes('Registre') || 
            line.match(/^MYB\d+/)) {
            break;
        }
        
        // Buscar líneas que empiecen con fecha YYYY-MM-DD
        // Formato: 2025-12-31   2025-12-31   99900000251231   TAXA IRPF   -0,17   5.340,39
        const datePattern = /^(\d{4}-\d{2}-\d{2})/;
        const dateMatch = line.match(datePattern);
        
        if (!dateMatch) continue;
        
        // Método robusto: extraer desde el final hacia adelante
        // 1. Extraer saldo e importe (son los más fijos y están al final)
        // 2. Extraer las dos fechas del inicio
        // 3. El resto es concepto + operación
        
        // Extraer saldo (último número con formato 5.340,39)
        const saldoMatchFinal = line.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*$/);
        let saldoStrExtracted = '';
        let lineBeforeSaldo = line;
        if (saldoMatchFinal) {
            saldoStrExtracted = saldoMatchFinal[1];
            lineBeforeSaldo = line.substring(0, saldoMatchFinal.index).trim();
        }
        
        // Extraer importe (penúltimo número con formato -0,17 o -2.400,00)
        // Buscar el último número antes del saldo
        const importeMatchFinal = lineBeforeSaldo.match(/\s{2,}(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*$/);
        let importeStrExtracted = '';
        let lineBeforeImporte = lineBeforeSaldo;
        if (importeMatchFinal) {
            importeStrExtracted = importeMatchFinal[1];
            lineBeforeImporte = lineBeforeSaldo.substring(0, importeMatchFinal.index).trim();
        } else {
            // Si no encuentra con espacios múltiples, buscar cualquier número antes del saldo
            const importeMatchAlt = lineBeforeSaldo.match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*$/);
            if (importeMatchAlt) {
                importeStrExtracted = importeMatchAlt[1];
                lineBeforeImporte = lineBeforeSaldo.substring(0, importeMatchAlt.index).trim();
            }
        }
        
        // Extraer las dos fechas del inicio
        const fechaOpMatch = lineBeforeImporte.match(/^(\d{4}-\d{2}-\d{2})/);
        const fechaValMatch = lineBeforeImporte.match(/\s{2,}(\d{4}-\d{2}-\d{2})/);
        
        if (!fechaOpMatch) {
            console.log('No se encontró fecha operación en:', line);
            continue;
        }
        
        const fechaOperacionStr = fechaOpMatch[1];
        const fechaValorStr = fechaValMatch ? fechaValMatch[1] : '';
        
        // El resto entre la segunda fecha y el inicio del importe es concepto + operación
        const inicioDatos = fechaValMatch ? fechaValMatch.index + fechaValMatch[0].length : fechaOpMatch.index + fechaOpMatch[0].length;
        const datos = lineBeforeImporte.substring(inicioDatos).trim();
        
        // Separar concepto y operación (separados por espacios múltiples)
        const datosParts = datos.split(/\s{2,}/).filter(p => p.trim());
        let concepteExtracted = '';
        let operacionExtracted = '';
        
        if (datosParts.length >= 2) {
            concepteExtracted = datosParts[0];
            operacionExtracted = datosParts.slice(1).join(' ');
        } else if (datosParts.length === 1) {
            // Si solo hay una parte, intentar separar si es un número seguido de texto
            const conceptMatch = datosParts[0].match(/^([A-Z0-9\/]+(?:\s+[A-Z0-9\/]+)?)\s{2,}(.+)$/);
            if (conceptMatch) {
                concepteExtracted = conceptMatch[1];
                operacionExtracted = conceptMatch[2];
            } else {
                // Si no se puede separar, asumir que todo es operación
                operacionExtracted = datosParts[0];
            }
        }
        
        // Construir array parts para compatibilidad con código siguiente
        const parts = [
            fechaOperacionStr,    // fecha operación
            fechaValorStr,        // fecha valor (se ignora)
            concepteExtracted,    // concepto
            operacionExtracted,   // operación
            importeStrExtracted,  // importe
            saldoStrExtracted     // saldo
        ];
        
        if (!parts[0] || !parts[4]) {
            console.log('No se pudieron extraer campos esenciales de:', line);
            console.log('Partes extraídas:', parts);
            continue;
        }
        
        // Parsear fecha operación (primera fecha, formato YYYY-MM-DD)
        const fechaStr = parts[0];
        const fechaMatch2 = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!fechaMatch2) {
            console.log('Fecha no válida:', fechaStr);
            continue;
        }
        
        const fecha = `${fechaMatch2[3]}/${fechaMatch2[2]}/${fechaMatch2[1]}`;
        
        // Concepte y operación ya están en parts
        const concepteFinal = parts[2] || '';
        const operacionFinal = parts[3] || '';
        
        // Importe y saldo ya están parseados en parts
        const importeStrFinal = parts[4] || '';
        const saldoStrFinal = parts[5] || '';
        
        // Parsear importe (formato: -0,17 o 1,73 o -2.400,00)
        let importe = null;
        if (importeStrFinal) {
            const importeNum = parseFloat(importeStrFinal.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(importeNum)) {
                importe = importeNum;
            }
        }
        
        // Parsear saldo (formato: 5.340,39)
        let saldo = null;
        if (saldoStrFinal) {
            const saldoNum = parseFloat(saldoStrFinal.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(saldoNum)) {
                saldo = saldoNum;
            }
        }
        
        if (importe === null) {
            console.log('No se pudo parsear el importe de:', line);
            console.log('Importe string:', importeStrFinal);
            continue;
        }
        
        // Determinar concepto y detalle
        let concepto = 'Transacción';
        let detalle = operacionFinal || concepteFinal;
        
        // Limpiar detalle de espacios extra
        detalle = detalle.replace(/\s+/g, ' ').trim();
        
        // Identificar tipo de transacción
        const lowerOp = operacionFinal.toLowerCase();
        if (lowerOp.includes('bizum')) {
            concepto = 'Bizum';
        } else if (lowerOp.includes('taxa') || lowerOp.includes('tasa')) {
            concepto = 'Tasa';
        } else if (lowerOp.includes('int.') || lowerOp.includes('interés') || lowerOp.includes('interes') || lowerOp.includes('crèdit') || lowerOp.includes('credit') || lowerOp.includes('cr è dit')) {
            concepto = 'Interés';
        } else if (lowerOp.includes('càrrec') || lowerOp.includes('cargo') || lowerOp.includes('targeta') || lowerOp.includes('tarjeta')) {
            concepto = 'Compra';
        } else if (lowerOp.includes('transferència') || lowerOp.includes('transferencia')) {
            concepto = 'Transferencia';
        } else if (lowerOp.includes('recibo') || lowerOp.includes('rebut')) {
            concepto = 'Recibo';
        }
        
        // Usar operación como detalle, o concepte si no hay operación
        if (!detalle || detalle.trim().length === 0) {
            detalle = concepte || concepto;
        }
        
        transactions.push({
            fecha: fecha,
            concepto: concepto,
            detalle: detalle.trim(),
            importe: importe,
            tipo: importe >= 0 ? 'ingreso' : 'gasto',
            saldo: saldo
        });
    }
    
    // Filtrar transacciones con importe 0
    const filteredTransactions = transactions.filter(t => t.importe !== null && Math.abs(t.importe) > 0.001);
    
    console.log('Transacciones MyAndBank extraídas:', filteredTransactions.length);
    
    // Ordenar por fecha descendente
    filteredTransactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return filteredTransactions;
}

function extractCreditAndorra(text, lines) {
    const transactions = [];
    
    // Detectar si es formato Crédit Andorrà
    const isCreditAndorra = text.includes('Crédit Andorrà') || 
                           text.includes('Credit Andorra') ||
                           text.includes('Creand') ||
                           (text.includes('Balance in EUR') && text.includes('Credit') && 
                            text.includes('Debit') && text.includes('Transaction') && 
                            text.includes('Date'));
    
    if (!isCreditAndorra) {
        return [];
    }
    
    console.log('Detectado formato Crédit Andorrà');
    
    // El formato es: Balance in EUR | Credit | Debit | Value data | Transaction | Date
    // Sin pipes, solo espacios
    let inTable = false;
    let headerFound = false;
    
    // Reconstruir líneas que pueden estar divididas
    let mergedLines = [];
    let currentLine = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Detectar encabezado de tabla
        if (line.includes('Balance in EUR') && line.includes('Credit') && 
            line.includes('Debit') && line.includes('Transaction') && 
            line.includes('Date')) {
            inTable = true;
            headerFound = true;
            if (currentLine) {
                mergedLines.push(currentLine.trim());
                currentLine = '';
            }
            mergedLines.push(line);
            continue;
        }
        
        // Detectar fin de tabla
        if (inTable && (line.includes('Sum of bookings') || 
                       line.includes('www.creand.ad') ||
                       (line.includes('IBAN:') && line.length > 50))) {
            if (currentLine) {
                mergedLines.push(currentLine.trim());
                currentLine = '';
            }
            inTable = false;
            continue;
        }
        
        if (!inTable || !headerFound) continue;
        
        // Detectar si la línea empieza con un número (saldo, crédito, débito) o fecha
        // Esto indica el inicio de una nueva fila de transacción
        const startsWithData = /^(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d{2}\.\d{2}\.\d{2}|\-?\d+)/.test(line);
        
        if (startsWithData || line.match(/^\d{2}\.\d{2}\.\d{2}/)) {
            if (currentLine) {
                mergedLines.push(currentLine.trim());
            }
            currentLine = line;
        } else if (currentLine) {
            // Continuación de la línea anterior (Transaction puede ser multilínea)
            currentLine += ' ' + line;
        }
    }
    
    if (currentLine) {
        mergedLines.push(currentLine.trim());
    }
    
        // Procesar líneas fusionadas
        for (const line of mergedLines) {
            if (!line || line.includes('Balance in EUR')) continue;
            
            // Filtrar líneas de resumen (Sum of bookings)
            if (line.toLowerCase().includes('sum of bookings')) continue;
        
        // Buscar todas las fechas en formato DD.MM.YY
        const fechaMatches = line.match(/\b(\d{2}\.\d{2}\.\d{2})\b/g);
        if (!fechaMatches || fechaMatches.length === 0) continue;
        
        const fechaOperacion = fechaMatches[fechaMatches.length - 1]; // Última fecha es la de operación
        
        // Patrón para números europeos (coma decimal, punto miles)
        const numberPattern = /(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g;
        
        // Buscar todos los números en la línea
        const allNumberMatches = [];
        let match;
        while ((match = numberPattern.exec(line)) !== null) {
            const numStr = match[1];
            const num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(num)) {
                allNumberMatches.push({
                    str: numStr,
                    value: num,
                    index: match.index
                });
            }
        }
        
        // Buscar posiciones de fechas
        const fechaIndices = [];
        for (const fecha of fechaMatches) {
            const index = line.indexOf(fecha);
            if (index >= 0) {
                fechaIndices.push({ fecha, index });
            }
        }
        
        // Ordenar números e índices de fechas por posición
        allNumberMatches.sort((a, b) => a.index - b.index);
        fechaIndices.sort((a, b) => a.index - b.index);
        
        // Identificar qué números son Balance, Credit, Debit
        // Están ANTES de la primera fecha
        const firstFechaIndex = fechaIndices.length > 0 ? fechaIndices[0].index : line.length;
        const numbersBeforeFecha = allNumberMatches.filter(n => n.index < firstFechaIndex);
        
        let saldo = null;
        let credit = null;
        let debit = null;
        let importe = null;
        
        // Clasificar números antes de la primera fecha
        if (numbersBeforeFecha.length === 1) {
            // Solo Balance (Previous balance)
            saldo = numbersBeforeFecha[0].value;
            importe = 0;
        } else if (numbersBeforeFecha.length === 2) {
            // Balance y Credit o Debit
            saldo = numbersBeforeFecha[0].value;
            const secondNum = numbersBeforeFecha[1].value;
            if (secondNum < 0) {
                // Es un débito
                debit = Math.abs(secondNum);
                importe = -debit;
            } else {
                // Es un crédito
                credit = secondNum;
                importe = credit;
            }
        } else if (numbersBeforeFecha.length >= 3) {
            // Balance, Credit, Debit
            saldo = numbersBeforeFecha[0].value;
            credit = numbersBeforeFecha[1].value > 0 ? numbersBeforeFecha[1].value : null;
            debit = numbersBeforeFecha[2].value < 0 ? Math.abs(numbersBeforeFecha[2].value) : 
                   numbersBeforeFecha[2].value > 0 ? numbersBeforeFecha[2].value : null;
            
            // Determinar importe: prioridad a crédito, luego débito
            if (credit !== null && credit !== 0) {
                importe = credit;
            } else if (debit !== null && debit !== 0) {
                importe = -debit;
            }
        }
        
        // Si es "Previous balance", el importe es 0
        if (line.toLowerCase().includes('previous balance')) {
            importe = 0;
        }
        
        // Extraer transaction text
        // Todo entre los números iniciales y las fechas
        let transactionText = line;
        
        // Remover números iniciales (Balance, Credit, Debit)
        if (numbersBeforeFecha.length > 0) {
            const lastNumberIndex = numbersBeforeFecha[numbersBeforeFecha.length - 1].index;
            const lastNumberLength = numbersBeforeFecha[numbersBeforeFecha.length - 1].str.length;
            transactionText = transactionText.substring(lastNumberIndex + lastNumberLength).trim();
        }
        
        // Remover fechas
        for (const fechaInfo of fechaIndices) {
            transactionText = transactionText.replace(fechaInfo.fecha, '').trim();
        }
        
        // Remover números de referencia largos al inicio (ej: "1484577781 - ")
        transactionText = transactionText.replace(/^\d{10,}\s*-\s*/, '').trim();
        
        // Limpiar espacios múltiples
        transactionText = transactionText.replace(/\s+/g, ' ').trim();
        
        let concepto = '';
        let detalle = '';
        
        if (transactionText) {
            // Remover números de referencia al inicio (ej: "1484577781 - ")
            transactionText = transactionText.replace(/^\d+\s*-\s*/, '');
            
            // Separar tipo de transacción del detalle
            const parts = transactionText.split(' - ');
            if (parts.length > 1) {
                concepto = parts[0].trim();
                detalle = parts.slice(1).join(' - ').trim();
            } else {
                detalle = transactionText;
                // Intentar extraer tipo de transacción común
                const lowerText = transactionText.toLowerCase();
                if (lowerText.includes('payment')) {
                    concepto = 'Payment';
                } else if (lowerText.includes('transfer')) {
                    concepto = 'Transfer';
                } else if (lowerText.includes('direct debit')) {
                    concepto = 'Direct Debit';
                } else if (lowerText.includes('withdrawal')) {
                    concepto = 'Withdrawal';
                } else if (lowerText.includes('interest')) {
                    concepto = 'Interest';
                } else if (lowerText.includes('previous balance')) {
                    concepto = 'Previous balance';
                } else if (lowerText.includes('cybercard')) {
                    concepto = 'Cybercard';
                } else if (lowerText.includes('recepció') || lowerText.includes('recepcio')) {
                    concepto = 'Recepció transferència';
                } else if (lowerText.includes('money transfer')) {
                    concepto = 'Money Transfer';
                } else if (lowerText.includes('comissió')) {
                    concepto = 'Comissió';
                } else if (lowerText.includes('descobert')) {
                    concepto = 'Descobert';
                } else {
                    concepto = 'Transaction';
                }
            }
        }
        
        // Solo agregar si tenemos fecha y el importe no es 0 o null
        // Filtrar transacciones con importe 0€ (incluyendo Previous balance)
        if (fechaOperacion && importe !== null && Math.abs(importe) > 0.001) {
            // Convertir fecha de DD.MM.YY a DD/MM/YYYY para consistencia
            const fechaParts = fechaOperacion.split('.');
            if (fechaParts.length === 3) {
                let year = parseInt(fechaParts[2], 10);
                if (year < 100) {
                    year += 2000;
                }
                const fechaFormatted = `${fechaParts[0]}/${fechaParts[1]}/${year}`;
                
                transactions.push({
                    fecha: fechaFormatted,
                    concepto: concepto || 'Transaction',
                    detalle: detalle || concepto || '',
                    importe: importe,
                    tipo: importe >= 0 ? 'ingreso' : 'gasto',
                    saldo: saldo
                });
            }
        }
    }
    
    // Filtrar cualquier transacción que se haya escapado con importe 0
    const filteredTransactions = transactions.filter(t => t.importe !== null && Math.abs(t.importe) > 0.001);
    
    // Ordenar por fecha descendente
    filteredTransactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return filteredTransactions;
}

// Extraer transacciones del texto del PDF (método principal)
function extractTransactions(text) {
    const transactions = [];
    const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 2);
    const datePattern = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
    const amountPattern = /(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/gi;
    let inTableSection = false;
    let tableStarted = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Detectar formato de tabla con pipes (formato francés MORABANC)
        if (line.includes('|') && (line.includes('Date') || line.includes('Libellé') || line.includes('Détail') || line.includes('Montant'))) {
            inTableSection = true;
            tableStarted = true;
            
            // Intentar parsear líneas de tabla
            let j = i + 1;
            while (j < lines.length && lines[j].includes('|')) {
                const tableLine = lines[j].trim();
                if (tableLine.match(/\d{2}\/\d{2}\/\d{4}/)) {
                    // Dividir por pipes y filtrar columnas vacías, pero mantener el orden
                    const columns = tableLine.split('|').map(c => c.trim()).filter(c => c && c.length > 0);
                    if (columns.length >= 4) {
                        // Buscar fecha en las primeras columnas
                        let fecha = null;
                        let fechaIndex = -1;
                        for (let k = 0; k < Math.min(2, columns.length); k++) {
                            const fechaMatch = columns[k].match(/(\d{2}\/\d{2}\/\d{4})/);
                            if (fechaMatch) {
                                fecha = fechaMatch[1];
                                fechaIndex = k;
                                break;
                            }
                        }
                        
                        if (fecha) {
                            // Estructura: Date opération | Date valeur | Libellé | Détail | Montant | Solde
                            // Si fecha está en index 0, entonces Libellé está en 2, Détail en 3, Montant en 4
                            // Si fecha está en index 1, entonces Libellé está en 2, Détail en 3, Montant en 4
                            // Estructura típica: Date opération | Date valeur | Libellé | Détail | Montant | Solde
                            // O: Data operació | Data valor | Concepte | Detall | Import | Saldo
                            const concepto = fechaIndex === 0 && columns.length > 2 ? columns[2] : 
                                           fechaIndex === 1 && columns.length > 2 ? columns[2] : 
                                           columns[1] || '';
                            const detalle = fechaIndex === 0 && columns.length > 3 ? columns[3] : 
                                          fechaIndex === 1 && columns.length > 3 ? columns[3] : 
                                          columns[2] || columns[1] || '';
                            
                            // El importe (Montant) está en la penúltima columna, el saldo en la última
                            // Buscar el importe en todas las columnas excepto la última (que es el saldo)
                            let importe = null;
                            const columnsForImport = columns.slice(0, columns.length - 1); // Todas menos la última
                            
                            for (const col of columnsForImport) {
                                const match = col.match(amountPattern);
                                if (match) {
                                    const amountStr = match[1];
                                    const amountNum = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
                                    // El importe debe ser relativamente pequeño (transacciones típicamente < 10000)
                                    if (!isNaN(amountNum) && Math.abs(amountNum) > 0 && Math.abs(amountNum) < 100000) {
                                        importe = amountNum;
                                        break;
                                    }
                                }
                            }
                            
                            if (importe && !isNaN(importe)) {
                                // Intentar extraer el saldo de la última columna
                                // El saldo es siempre la última columna y normalmente es un número positivo grande
                                let saldo = null;
                                if (columns.length > 0) {
                                    // La última columna es el saldo
                                    const saldoCol = columns[columns.length - 1].trim();
                                    
                                    // Buscar todos los números en la última columna
                                    // El saldo suele ser el número más grande (sin signo negativo)
                                    const allNumbers = saldoCol.match(/\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?/g);
                                    if (allNumbers && allNumbers.length > 0) {
                                        // Convertir todos los números y encontrar el más grande (que debería ser el saldo)
                                        const parsedNumbers = allNumbers.map(num => {
                                            return parseFloat(num.replace(/\./g, '').replace(',', '.'));
                                        }).filter(n => !isNaN(n) && n >= 0);
                                        
                                        if (parsedNumbers.length > 0) {
                                            // El saldo es el número más grande de la última columna
                                            saldo = Math.max(...parsedNumbers);
                                        }
                                    }
                                    
                                    // Si no encontramos saldo, intentar con el patrón EUR
                                    if (!saldo) {
                                        const saldoPattern = /(\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/i;
                                        const saldoMatch = saldoCol.match(saldoPattern);
                                        if (saldoMatch) {
                                            const saldoStr = saldoMatch[1];
                                            const parsedSaldo = parseFloat(saldoStr.replace(/\./g, '').replace(',', '.'));
                                            if (!isNaN(parsedSaldo) && parsedSaldo >= 0) {
                                                saldo = parsedSaldo;
                                            }
                                        }
                                    }
                                }
                                
                                transactions.push({
                                    fecha: fecha,
                                    concepto: concepto || 'Transacción',
                                    detalle: detalle || concepto || '',
                                    importe: importe,
                                    tipo: importe >= 0 ? 'ingreso' : 'gasto',
                                    saldo: saldo
                                });
                            }
                        }
                    }
                }
                j++;
            }
            i = j - 1;
            continue;
        }
        
        // Detectar inicio de tabla en varios idiomas
        if (!tableStarted && (line.includes('Data operació') || line.includes('Data operaci') || 
            line.includes('Fecha operación') || line.includes('Date opération') ||
            line.includes('Date operation') || line.includes('Data valor') || 
            line.includes('Date valeur') || line.includes('Concepte') || 
            line.includes('Detall') || line.includes('Détail') || 
            line.includes('Libellé') || line.includes('Import') || 
            line.includes('Montant') || line.includes('Concepto'))) {
            inTableSection = true;
            tableStarted = true;
            continue;
        }
        
        // Detectar fin de tabla en varios idiomas
        if (line.includes('Extracció parcial') || 
            line.includes('Extraction de données') ||
            line.includes('Saldo anterior') || line.includes('Solde précédent') ||
            (line.match(/Pàgina\s+\d+\s+de\s+\d+/i)) ||
            (line.match(/Page\s+\d+\s+de\s+\d+/i))) {
            inTableSection = false;
            continue;
        }
        
        if (!inTableSection) continue;
        
        const dates = [];
        let dateMatch;
        const dateRegex = new RegExp(datePattern.source, 'g');
        while ((dateMatch = dateRegex.exec(line)) !== null) {
            dates.push(dateMatch[1]);
        }
        
        const amounts = [];
        let amountMatch;
        const amountRegex = new RegExp(amountPattern.source, 'gi');
        while ((amountMatch = amountRegex.exec(line)) !== null) {
            amounts.push(amountMatch[1]);
        }
        
        if (dates.length > 0 && amounts.length > 0) {
            const fecha = dates[0];
            let importeStr = amounts[0];
            
            if (amounts.length > 1) {
                const transaccionAmount = amounts.find(amt => {
                    const numStr = amt.replace(/[.-]/g, '');
                    return numStr.length < 8;
                }) || amounts[0];
                importeStr = transaccionAmount;
            }
            
            let importe = importeStr.replace(/\./g, '').replace(',', '.');
            const importeNum = parseFloat(importe);
            
            if (!isNaN(importeNum) && Math.abs(importeNum) > 0 && Math.abs(importeNum) < 1000000) {
                let restLine = line;
                dates.forEach(date => { restLine = restLine.replace(date, ''); });
                restLine = restLine.replace(amountPattern, '').replace(/\s+/g, ' ').trim();
                
                const conceptPatterns = [
                    // Catalán/Español
                    /Targeta\s+dèbit/i, /Targeta\s+solidària/i, /Rebut\s+domiciliat/i,
                    /Abon\.?\s+domiciliat/i, /Abon\.?\s+nòmina/i, /Carrec\s+Bizum/i,
                    /Abonam\.?\s+Bizum/i, /Reintegr\.?\s+caixer/i, /Com\.\s+custòdia/i,
                    /Transf\.?\s+nòmina/i, /Liquidació/i, /Tarjeta/i, /Tarjeta\s+débito/i,
                    /Reintegro/i, /Abono/i,
                    // Francés
                    /Carte\s+Electron/i, /Carte\s+électron/i, /Carte\s+de\s+débit/i,
                    /Versement/i, /Versement\s+domicilié/i, /Versement\s+Bizum/i,
                    /Prelevements/i, /Prelevements\s+Bizum/i, /Prélèvements/i,
                    /Virement/i, /Virem\.?\s+paie/i, /Virem\.?\s+paie\s+autres/i,
                    /Ret\.\s+carte/i, /Retrait/i
                ];
                
                let concepto = '';
                let detalle = '';
                
                for (const pattern of conceptPatterns) {
                    const match = restLine.match(pattern);
                    if (match) {
                        concepto = match[0].trim();
                        const afterConcept = restLine.substring(match.index + match[0].length).trim();
                        detalle = afterConcept.replace(/\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?\s*EUR/gi, '').trim();
                        break;
                    }
                }
                
                if (!concepto) {
                    const parts = restLine.split(/\s{2,}|\t|[|]/).filter(p => p.trim().length > 0);
                    if (parts.length >= 1) {
                        concepto = parts.find(p => !/^\d/.test(p.trim())) || parts[0] || 'Transacción';
                        detalle = parts.filter(p => p !== concepto).join(' ').trim();
                        detalle = detalle.replace(/\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?\s*EUR/gi, '').trim();
                    } else {
                        detalle = restLine;
                    }
                }
                
                detalle = detalle.replace(/\d{2}\/\d{2}\/\d{4}/g, '').trim();
                detalle = detalle.replace(/\s+/g, ' ').trim();
                
                if (!concepto) concepto = 'Transacción';
                if (!detalle && concepto) detalle = concepto;
                
                transactions.push({
                    fecha: fecha,
                    concepto: concepto,
                    detalle: detalle,
                    importe: importeNum,
                    tipo: importeNum >= 0 ? 'ingreso' : 'gasto',
                    saldo: null // Se calculará después si no está disponible
                });
            }
        }
    }
    
    transactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return transactions;
}

// Método alternativo
function extractTransactionsAlternative(textItems) {
    let text = '';
    let lastY = null;
    
    for (const item of textItems) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            text += '\n';
        }
        text += item.str + ' ';
        lastY = item.transform[5];
    }
    
    return extractTransactions(text);
}

// Método agresivo
function extractTransactionsAggressive(text) {
    const transactions = [];
    const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 5);
    const datePattern = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
    const amountPattern = /(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/gi;
    
    for (const line of lines) {
        const dates = [];
        const dateRegex = new RegExp(datePattern.source, 'g');
        let dateMatch;
        while ((dateMatch = dateRegex.exec(line)) !== null) {
            dates.push(dateMatch[1]);
        }
        
        const amounts = [];
        const amountRegex = new RegExp(amountPattern.source, 'gi');
        let amountMatch;
        while ((amountMatch = amountRegex.exec(line)) !== null) {
            const amountStr = amountMatch[1];
            const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(amount) && Math.abs(amount) < 100000 && Math.abs(amount) > 0.01) {
                amounts.push(amountStr);
            }
        }
        
        if (dates.length > 0 && amounts.length > 0) {
            const fecha = dates[0];
            let importeStr = amounts[0];
            if (amounts.length > 1) {
                amounts.sort((a, b) => {
                    const numA = parseFloat(a.replace(/\./g, '').replace(',', '.'));
                    const numB = parseFloat(b.replace(/\./g, '').replace(',', '.'));
                    return Math.abs(numA) - Math.abs(numB);
                });
                importeStr = amounts[0];
            }
            
            let importe = importeStr.replace(/\./g, '').replace(',', '.');
            const importeNum = parseFloat(importe);
            
            if (!isNaN(importeNum)) {
                let restLine = line;
                dates.forEach(d => restLine = restLine.replace(d, ''));
                restLine = restLine.replace(amountPattern, '').replace(/\s+/g, ' ').trim();
                
                const conceptPatterns = [
                    // Catalán/Español
                    /Targeta\s+dèbit/i, /Targeta\s+solidària/i, /Rebut\s+domiciliat/i,
                    /Abon\.?\s+domiciliat/i, /Abon\.?\s+nòmina/i, /Carrec\s+Bizum/i,
                    /Abonam\.?\s+Bizum/i, /Reintegr\.?\s+caixer/i, /Com\.\s+custòdia/i,
                    /Transf\.?\s+nòmina/i, /Liquidació/i, /Tarjeta/i, /Tarjeta\s+débito/i,
                    /Reintegro/i, /Abono/i,
                    // Francés
                    /Carte\s+Electron/i, /Carte\s+électron/i, /Carte\s+de\s+débit/i,
                    /Versement/i, /Versement\s+domicilié/i, /Versement\s+Bizum/i,
                    /Prelevements/i, /Prelevements\s+Bizum/i, /Prélèvements/i,
                    /Virement/i, /Virem\.?\s+paie/i, /Virem\.?\s+paie\s+autres/i,
                    /Ret\.\s+carte/i, /Retrait/i
                ];
                
                let concepto = '';
                let detalle = '';
                
                for (const pattern of conceptPatterns) {
                    const match = restLine.match(pattern);
                    if (match) {
                        concepto = match[0].trim();
                        detalle = restLine.substring(match.index + match[0].length).trim();
                        break;
                    }
                }
                
                if (!concepto) {
                    const parts = restLine.split(/\s{2,}/).filter(p => p.trim());
                    concepto = parts[0] || 'Transacción';
                    detalle = parts.slice(1).join(' ').trim();
                }
                
                detalle = detalle.replace(/\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?\s*EUR/gi, '').trim();
                detalle = detalle.replace(/\d{2}\/\d{2}\/\d{4}/g, '').trim();
                
                if (!concepto) concepto = 'Transacción';
                if (!detalle && concepto) detalle = concepto;
                
                transactions.push({
                    fecha: fecha,
                    concepto: concepto,
                    detalle: detalle,
                    importe: importeNum,
                    tipo: importeNum >= 0 ? 'ingreso' : 'gasto',
                    saldo: null // Se calculará después si no está disponible
                });
            }
        }
    }
    
    transactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return transactions;
}

// Método multilínea
function extractTransactionsMultiline(lines) {
    const transactions = [];
    const datePattern = /^\s*(\d{2}\/\d{2}\/\d{4})\s*$/;
    const amountPattern = /(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/i;
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        const fechaMatch = line.match(datePattern);
        if (fechaMatch) {
            const fechaOperacion = fechaMatch[1];
            const transactionLines = [line];
            let j = i + 1;
            
            // Buscar hasta encontrar la próxima fecha (el saldo está justo antes de la fecha siguiente)
            while (j < lines.length && transactionLines.length < 20) {
                const nextLine = lines[j].trim();
                
                // Si encontramos otra fecha, terminamos (el saldo está en la línea anterior)
                if (nextLine.match(datePattern)) {
                    break;
                }
                
                transactionLines.push(nextLine);
                j++;
            }
            
            const filteredLines = transactionLines.filter(l => l.trim().length > 0);
            if (filteredLines.length >= 3) {
                const transaction = parseTransactionLines(filteredLines, fechaOperacion);
                if (transaction) {
                    transactions.push(transaction);
                }
            }
            
            i = j;
        } else {
            i++;
        }
    }
    
    transactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return transactions;
}

function parseTransactionLines(lines, fechaOperacion) {
    const datePattern = /^\s*(\d{2}\/\d{2}\/\d{4})\s*$/;
    const amountPattern = /(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/i;
    const saldoPattern = /(\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/i; // Saldo sin signo negativo
    
    // Intentar primero detectar si es una tabla con columnas (formato francés)
    // Buscar una línea que contenga columnas separadas por | o múltiples espacios
    let tableFormat = false;
    let columnIndexes = null;
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        if (line.includes('|') || (line.includes('Date') && (line.includes('Libellé') || line.includes('Détail') || line.includes('Detall')))) {
            // Detectar formato de tabla
            if (line.includes('|')) {
                const columns = line.split('|').map(c => c.trim()).filter(c => c);
                // Buscar índices de columnas relevantes
                const libelleIndex = columns.findIndex(c => c.toLowerCase().includes('libellé') || c.toLowerCase().includes('concepte') || c.toLowerCase().includes('concepto'));
                const detailIndex = columns.findIndex(c => c.toLowerCase().includes('détail') || c.toLowerCase().includes('detall') || c.toLowerCase().includes('detalle'));
                const montantIndex = columns.findIndex(c => c.toLowerCase().includes('montant') || c.toLowerCase().includes('import'));
                
                if (libelleIndex !== -1 || detailIndex !== -1) {
                    tableFormat = true;
                    columnIndexes = { libelle: libelleIndex, detail: detailIndex, montant: montantIndex };
                    break;
                }
            }
        }
    }
    
    // Si es formato de tabla, parsear como tabla
    if (tableFormat && columnIndexes) {
        // Buscar la primera línea de datos después de los encabezados
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('|')) {
                const columns = line.split('|').map(c => c.trim()).filter(c => c);
                if (columns.length > 3) {
                    const fechaMatch = columns[0].match(/(\d{2}\/\d{2}\/\d{4})/);
                    if (fechaMatch) {
                        const libelle = columnIndexes.libelle !== -1 ? columns[columnIndexes.libelle] || '' : '';
                        const detalle = columnIndexes.detail !== -1 ? columns[columnIndexes.detail] || '' : '';
                        const montantCol = columnIndexes.montant !== -1 ? columns[columnIndexes.montant] || '' : '';
                        
                        // Buscar importe en la columna de montant o en cualquier columna
                        let importe = null;
                        if (montantCol) {
                            const amountMatch = montantCol.match(amountPattern);
                            if (amountMatch) {
                                const amountStr = amountMatch[1];
                                importe = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
                            }
                        }
                        
                        // Si no encontramos en montant, buscar en todas las columnas
                        if (!importe) {
                            for (const col of columns) {
                                const amountMatch = col.match(amountPattern);
                                if (amountMatch) {
                                    const amountStr = amountMatch[1];
                                    const amountNum = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
                                    if (!isNaN(amountNum) && Math.abs(amountNum) < 10000 && Math.abs(amountNum) > 0) {
                                        importe = amountNum;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (importe) {
                            return {
                                fecha: fechaOperacion,
                                concepto: libelle || 'Transacción',
                                detalle: detalle || libelle || '',
                                importe: importe,
                                tipo: importe >= 0 ? 'ingreso' : 'gasto'
                            };
                        }
                    }
                }
            }
        }
    }
    
    let concepto = '';
    let detalle = '';
    let importe = null;
    
    if (lines.length < 3) return null;
    
    let lineIndex = 1;
    
    const conceptPatterns = [
        // Catalán/Español
        /Targeta\s+dèbit/i, /Targeta\s+solidària/i, /Rebut\s+domiciliat/i,
        /Abon\.?\s+domiciliat/i, /Abon\.?\s+nòmina/i, /Carrec\s+Bizum/i,
        /Abonam\.?\s+Bizum/i, /Reintegr\.?\s+caixer/i, /Com\.\s+custòdia/i,
        /Transf\.?\s+nòmina/i, /Liquidació/i, /Tarjeta/i, /Tarjeta\s+débito/i,
        /Reintegro/i, /Abono/i,
        // Francés
        /Carte\s+Electron/i, /Carte\s+électron/i, /Carte\s+de\s+débit/i,
        /Versement/i, /Versement\s+domicilié/i, /Versement\s+Bizum/i,
        /Prelevements/i, /Prelevements\s+Bizum/i, /Prélèvements/i,
        /Virement/i, /Virem\.?\s+paie/i, /Virem\.?\s+paie\s+autres/i,
        /Ret\.\s+carte/i, /Retrait/i
    ];
    
    for (let i = lineIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.match(datePattern)) {
            continue;
        }
        
        let foundConcept = false;
        for (const pattern of conceptPatterns) {
            if (pattern.test(line)) {
                concepto = line.match(pattern)[0].trim();
                foundConcept = true;
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    if (nextLine && !nextLine.match(datePattern) && !amountPattern.test(nextLine)) {
                        detalle = nextLine;
                    }
                }
                break;
            }
        }
        
        if (!foundConcept && 
            !line.match(datePattern) && 
            !amountPattern.test(line) &&
            line.length > 0 &&
            !/^\d/.test(line) &&
            !concepto) {
            concepto = line;
        }
        
        if (amountPattern.test(line)) {
            const match = line.match(amountPattern);
            if (match) {
                const amountStr = match[1];
                const amountNum = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(amountNum) && Math.abs(amountNum) < 10000 && Math.abs(amountNum) > 0) {
                    if (importe === null) {
                        importe = amountNum;
                    }
                }
            }
        }
    }
    
    if (!importe) return null;
    
    // Buscar el saldo en la última línea del bloque (formato multilínea)
    // El saldo es un número positivo grande (sin signo negativo) que aparece después del importe
    let saldo = null;
    if (lines.length > 0) {
        // Buscar desde el final hacia atrás
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Buscar un número positivo grande con EUR (saldo)
            const saldoMatch = line.match(saldoPattern);
            if (saldoMatch) {
                const saldoStr = saldoMatch[1];
                const saldoNum = parseFloat(saldoStr.replace(/\./g, '').replace(',', '.'));
                // El saldo debe ser positivo y relativamente grande (típicamente > 100)
                if (!isNaN(saldoNum) && saldoNum > 0 && saldoNum >= 100) {
                    saldo = saldoNum;
                    break;
                }
            }
        }
    }
    
    return {
        fecha: fechaOperacion,
        concepto: concepto || 'Transacción',
        detalle: detalle || concepto || '',
        importe: importe,
        tipo: importe >= 0 ? 'ingreso' : 'gasto',
        saldo: saldo
    };
}

// Método flexible
function extractTransactionsFlexible(lines) {
    const transactions = [];
    const datePattern = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
    const amountPatterns = [
        /(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)\s*EUR/gi,
        /EUR\s*(-?\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?)/gi,
        /(-?\d+[.,]\d{2})\s*EUR/gi
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 10) continue;
        
        const dates = [];
        const dateRegex = new RegExp(datePattern.source, 'g');
        let dateMatch;
        while ((dateMatch = dateRegex.exec(line)) !== null) {
            dates.push(dateMatch[1]);
        }
        
        if (dates.length === 0) continue;
        
        const amounts = [];
        for (const pattern of amountPatterns) {
            const amountRegex = new RegExp(pattern.source, 'gi');
            let amountMatch;
            while ((amountMatch = amountRegex.exec(line)) !== null) {
                const amountStr = amountMatch[1] || amountMatch[0].replace(/EUR/gi, '').trim();
                const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(amount) && Math.abs(amount) >= 0.01 && Math.abs(amount) < 100000) {
                    amounts.push(amountStr);
                }
            }
        }
        
        if (amounts.length === 0) continue;
        
        for (const fecha of dates) {
            let importeStr = amounts[0];
            if (amounts.length > 1) {
                const sorted = amounts.sort((a, b) => {
                    const numA = Math.abs(parseFloat(a.replace(/\./g, '').replace(',', '.')));
                    const numB = Math.abs(parseFloat(b.replace(/\./g, '').replace(',', '.')));
                    return numA - numB;
                });
                importeStr = sorted[0];
            }
            
            let importe = importeStr.replace(/\./g, '').replace(',', '.');
            const importeNum = parseFloat(importe);
            
            if (isNaN(importeNum)) continue;
            
            let restLine = line;
            restLine = restLine.replace(new RegExp(fecha.replace(/\//g, '\\/'), 'g'), '');
            for (const pattern of amountPatterns) {
                restLine = restLine.replace(pattern, '');
            }
            restLine = restLine.replace(/\s+/g, ' ').trim();
            
            const conceptPatterns = [
                // Catalán/Español
                /Targeta\s+dèbit/i, /Targeta\s+solidària/i, /Rebut\s+domiciliat/i,
                /Abon\.?\s+domiciliat/i, /Abon\.?\s+nòmina/i, /Carrec\s+Bizum/i,
                /Abonam\.?\s+Bizum/i, /Reintegr\.?\s+caixer/i, /Com\.\s+custòdia/i,
                /Transf\.?\s+nòmina/i, /Liquidació/i, /Tarjeta/i, /Tarjeta\s+débito/i,
                /Reintegro/i, /Abono/i, /Transferencia/i, /Pago/i, /Recibo/i, /Domiciliaci/i,
                // Francés
                /Carte\s+Electron/i, /Carte\s+électron/i, /Carte\s+de\s+débit/i,
                /Versement/i, /Versement\s+domicilié/i, /Versement\s+Bizum/i,
                /Prelevements/i, /Prelevements\s+Bizum/i, /Prélèvements/i,
                /Virement/i, /Virem\.?\s+paie/i, /Virem\.?\s+paie\s+autres/i,
                /Ret\.\s+carte/i, /Retrait/i
            ];
            
            let concepto = '';
            let detalle = '';
            
            for (const pattern of conceptPatterns) {
                const match = restLine.match(pattern);
                if (match) {
                    concepto = match[0].trim();
                    detalle = restLine.substring(match.index + match[0].length).trim();
                    break;
                }
            }
            
            if (!concepto) {
                const parts = restLine.split(/\s{2,}|\t|[|]/).filter(p => p.trim().length > 0);
                if (parts.length > 0) {
                    concepto = parts[0].trim();
                    detalle = parts.slice(1).join(' ').trim();
                } else {
                    detalle = restLine;
                }
            }
            
            detalle = detalle.replace(/\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?\s*EUR/gi, '').trim();
            detalle = detalle.replace(/\d{2}\/\d{2}\/\d{4}/g, '').trim();
            detalle = detalle.replace(/\s+/g, ' ').trim();
            
            if (!concepto) concepto = 'Transacción';
            if (!detalle) detalle = concepto;
            
            const isDuplicate = transactions.some(t => 
                t.fecha === fecha && 
                Math.abs(t.importe - importeNum) < 0.01
            );
            
            if (!isDuplicate) {
                transactions.push({
                    fecha: fecha,
                    concepto: concepto,
                    detalle: detalle,
                    importe: importeNum,
                    tipo: importeNum >= 0 ? 'ingreso' : 'gasto',
                    saldo: null // Se calculará después si no está disponible
                });
            }
        }
    }
    
    transactions.sort((a, b) => {
        try {
            const dateA = parseDate(a.fecha);
            const dateB = parseDate(b.fecha);
            return dateB - dateA;
        } catch (e) {
            return 0;
        }
    });
    
    return transactions;
}

// Función auxiliar para parsear fechas
function parseDate(dateStr) {
    // Primero intentar formato YYYY-MM-DD (MyAndBank)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
    try {
        // Formato DD/MM/YYYY
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/').map(Number);
            if (day && month && year && year > 2000 && year < 2100) {
                return new Date(year, month - 1, day);
            }
        }
        // Formato DD.MM.YY (Crédit Andorrà)
        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                let year = parseInt(parts[2], 10);
                // Convertir año de 2 dígitos a 4 dígitos (asumir 2000-2099)
                if (year < 100) {
                    year += 2000;
                }
                if (day && month && year && year >= 2000 && year < 2100) {
                    return new Date(year, month - 1, day);
                }
            }
        }
    } catch (e) {
        console.error('Error parseando fecha:', dateStr, e);
    }
    return new Date(0);
}

// Clasificar transacciones por categoría
function classifyTransaction(transaction) {
    const learnedCat = findLearnedClassification(transaction.detalle, transaction.concepto);
    if (learnedCat) {
        return learnedCat;
    }
    
    if (transaction.tipo === 'ingreso') {
        if (transaction.concepto.toLowerCase().includes('nòmina') || 
            transaction.concepto.toLowerCase().includes('nomina') ||
            transaction.detalle.toLowerCase().includes('nomina') ||
            transaction.concepto.toLowerCase().includes('paie') ||
            transaction.detalle.toLowerCase().includes('paie')) {
            return 'Salario';
        }
        if (transaction.concepto.toLowerCase().includes('domiciliat') || 
            transaction.concepto.toLowerCase().includes('domiciliado') ||
            transaction.concepto.toLowerCase().includes('domicilié') ||
            transaction.concepto.toLowerCase().includes('virement')) {
            return 'Devolución';
        }
        return 'Ingreso';
    }
    
    const detalleLower = (transaction.detalle || '').toLowerCase();
    const conceptoLower = (transaction.concepto || '').toLowerCase();
    const textoCompleto = detalleLower + ' ' + conceptoLower;
    
    if (textoCompleto.match(/restaur|cedasa|bar|bodega|pizzer|pasta|comida|food|mcdonald|burger|cafe|café|pizzeria|taverna|mesón|meson|churrer|pasteler|confiter|snack|viena|cena|comer|almuerzo|desayuno|establecimientos|establiments|borda|fragments|catalina|el bar|tragar|alicer|bernard|bistrot|delices|meroil|brioche|sushi|shop|critérium/i)) {
        return 'Restauración';
    }
    
    if (textoCompleto.match(/farmac|salut|health|4health|hospital|clínica|clinica|medic|dentista|óptica|optica|fisioterapia|psicolog|pharmacie|optique|medical|medic|pharm|artemi|metro/i)) {
        return 'Salud';
    }
    
    if (textoCompleto.match(/zara|h&m|mango|primark|pull&bear|bershka|stradivarius|massimo|dutti|lefties|ropa|moda|tienda|tiendas|fashion|outlet|textil|etam|intimissimi|beau bazar|petite brindill/i)) {
        return 'Moda';
    }
    
    if (textoCompleto.match(/pokerstars|stars|cine|película|pelicula|teatro|museo|parque|attracción|attraccion|diversión|diversion|ocio|recreo|gaming|juego|videojuego|netflix|spotify|disney|hbo|streaming|booking|hotel|hostel|viaje|viajes|travel|cinemes|carlema/i)) {
        return 'Ocio';
    }
    
    if (textoCompleto.match(/aena|aeropuerto|airport|aparcamiento|aparcament|parking|taxi|uber|cabify|transporte|metro|bus|autobús|autobus|renfe|ave|tren|gasolinera|gasolin|repostar|peaje|aparcament auto|estacio|servei|serv|esso|st leger|blablacar/i)) {
        return 'Transporte';
    }
    
    if (textoCompleto.match(/esportiu|deporte|deport|gimnasio|gym|fitness|natación|natacion|piscina|baloncesto|fútbol|futbol|tenis|padel|yoga|pilates|running|centre esportiu/i)) {
        return 'Deporte';
    }
    
    if (textoCompleto.match(/supermerc|mercado|aliment|hipercor|carrefour|alcampo|eroski|mercadona|lidl|aldi|dia|consum|caprabo|condis|bonpreu|el corte inglés|corte ingles|intermarché|intermarche|centre|comercial|cca4|caprabo/i)) {
        return 'Supermercado';
    }
    
    if (textoCompleto.match(/telecom|telefonía|telefonia|internet|fibra|wifi|luz|electricidad|gas|agua|suministro|servicio|hosting|hostinger|dominio|cloud/i)) {
        return 'Servicios';
    }
    
    if (textoCompleto.match(/coursera|educación|educacion|curso|curs|universidad|colegio|escuela|academia|formación|formacion|aprender|estudio/i)) {
        return 'Educación';
    }
    
    if (textoCompleto.match(/bizum|transfer|transferencia|comisión|comision|custodia|retir|cajero|caixer|reintegr|tarjeta|targeta|domiciliaci|domiciliat|nómina|nomina|versement|prelevements|virement|retrait|prélèvement|bancaire/i)) {
        return 'Bancario';
    }
    
    if (textoCompleto.match(/cursor|google|apple|microsoft|amazon|tecnología|tecnologia|ordenador|pc|portátil|portatil|móvil|movil|tablet|software|hardware|app|aplicación|aplicacion/i)) {
        return 'Tecnología';
    }
    
    if (textoCompleto.match(/ikea|leroy|merlin|bricolage|brico|ferreter|hogar|casa|mueble|decoración|decoracion|electrodoméstico|electrodomestico|electrónica|electronica/i)) {
        return 'Hogar';
    }
    
    if (textoCompleto.match(/perfumería|perfumeria|cosmético|cosmetico|maquillaje|belleza|droguería|drogueria/i)) {
        return 'Belleza';
    }
    
    return 'Otros';
}

// Mostrar transacciones en la tabla
function displayTransactions(transactions) {
    transactionsBody.innerHTML = '';
    
    let totalIngresos = 0;
    let totalGastos = 0;
    
    transactions.forEach((transaction, index) => {
        const categoria = classifyTransaction(transaction);
        transaction.categoria = categoria;
        
        const row = document.createElement('tr');
        
        const amount = transaction.importe;
        if (amount >= 0) {
            totalIngresos += amount;
        } else {
            totalGastos += Math.abs(amount);
        }
        
        const formattedAmount = new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(Math.abs(amount));
        
        const categoriaClass = categoria.toLowerCase()
            .replace(/á/g, 'a')
            .replace(/é/g, 'e')
            .replace(/í/g, 'i')
            .replace(/ó/g, 'o')
            .replace(/ú/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/ü/g, 'u')
            .replace(/\s+/g, '-');
        
        row.innerHTML = `
            <td>${transaction.fecha}</td>
            <td>${transaction.concepto}</td>
            <td>${transaction.detalle}</td>
            <td class="amount ${amount >= 0 ? 'positive' : 'negative'}">
                ${amount >= 0 ? '+' : '-'}${formattedAmount}
            </td>
            <td>
                <span class="type-badge ${transaction.tipo}">
                    ${transaction.tipo}
                </span>
            </td>
            <td class="category-cell" data-index="${index}">
                <select class="category-select" data-index="${index}">
                    ${CATEGORIAS.map(cat => 
                        `<option value="${cat}" ${cat === categoria ? 'selected' : ''}>${cat}</option>`
                    ).join('')}
                </select>
                <span class="category-badge category-${categoriaClass} category-display">
                    ${categoria}
                </span>
            </td>
        `;
        
        transactionsBody.appendChild(row);
        
        const categorySelect = row.querySelector('.category-select');
        const categoryBadge = row.querySelector('.category-badge');
        
        categoryBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryBadge.style.display = 'none';
            categorySelect.style.display = 'inline-block';
            categorySelect.focus();
        });
        
        categorySelect.addEventListener('change', async (e) => {
            const newCategoria = e.target.value;
            const newCategoriaClass = newCategoria.toLowerCase()
                .replace(/á/g, 'a')
                .replace(/é/g, 'e')
                .replace(/í/g, 'i')
                .replace(/ó/g, 'o')
                .replace(/ú/g, 'u')
                .replace(/ñ/g, 'n')
                .replace(/ü/g, 'u')
                .replace(/\s+/g, '-');
            
            categoryBadge.textContent = newCategoria;
            categoryBadge.className = `category-badge category-${newCategoriaClass} category-display`;
            
            categorySelect.style.display = 'none';
            categoryBadge.style.display = 'inline-block';
            
            await saveClassification(transaction.detalle, transaction.concepto, newCategoria);
            transactions[index].categoria = newCategoria;
            
            try {
                updateExpensesChart();
                updateExpensesTimeChart();
                updateBalanceTimeChart();
                updateSankeyChart();
            } catch (chartError) {
                console.error('Error actualizando gráficos:', chartError);
            }
        });
        
        categorySelect.addEventListener('blur', () => {
            setTimeout(() => {
                categorySelect.style.display = 'none';
                categoryBadge.style.display = 'inline-block';
            }, 200);
        });
    });
    
    totalTransactions.textContent = `${transactions.length} transacciones`;
    totalIncome.textContent = `Ingresos: ${new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(totalIngresos)}`;
    totalExpenses.textContent = `Gastos: ${new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(totalGastos)}`;
    
    try {
        updateExpensesChart();
        updateExpensesTimeChart();
        updateBalanceTimeChart();
        updateSankeyChart();
    } catch (chartError) {
        console.error('Error creando gráficos:', chartError);
    }
}

// Calcular gastos por categoría
function calculateExpensesByCategory() {
    const expensesByCategory = {};
    
    transactions.forEach(transaction => {
        if (transaction.tipo === 'gasto' && transaction.importe < 0) {
            const categoria = transaction.categoria || 'Otros';
            const amount = Math.abs(transaction.importe);
            
            if (!expensesByCategory[categoria]) {
                expensesByCategory[categoria] = 0;
            }
            expensesByCategory[categoria] += amount;
        }
    });
    
    return expensesByCategory;
}

// Colores para categorías
function getCategoryColor(categoria) {
    const categoriaLower = categoria.toLowerCase()
        .replace(/á/g, 'a')
        .replace(/é/g, 'e')
        .replace(/í/g, 'i')
        .replace(/ó/g, 'o')
        .replace(/ú/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/ü/g, 'u')
        .replace(/\s+/g, '-');
    
    const colorMap = {
        'restauracion': '#fff3cd',
        'salud': '#f8d7da',
        'moda': '#e2e3f5',
        'ocio': '#d4edda',
        'transporte': '#cfe2ff',
        'deporte': '#d1ecf1',
        'supermercado': '#fff3cd',
        'servicios': '#e7f3ff',
        'educacion': '#f8f9fa',
        'bancario': '#e2e3f5',
        'tecnologia': '#d0e7ff',
        'hogar': '#fff3e0',
        'belleza': '#fce4ec',
        'salario': '#c8e6c9',
        'devolucion': '#b2dfdb',
        'ingreso': '#c5e1a5',
        'otros': '#e0e0e0'
    };
    
    return colorMap[categoriaLower] || '#e0e0e0';
}

// Actualizar gráfico circular
function updateExpensesChart() {
    const expensesByCategory = calculateExpensesByCategory();
    
    if (Object.keys(expensesByCategory).length === 0) {
        if (expensesChart) {
            expensesChart.destroy();
            expensesChart = null;
        }
        return;
    }
    
    const sortedCategories = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedCategories.map(([categoria]) => categoria);
    const data = sortedCategories.map(([, amount]) => amount);
    const colors = labels.map(categoria => getCategoryColor(categoria));
    
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return;
    
    if (expensesChart) {
        expensesChart.destroy();
    }
    
    // Configurar alta resolución para el canvas
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    
    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: dpr,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 18,
                        font: {
                            size: 14,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 12,
                        boxHeight: 12
                    },
                    generateLabels: function(chart) {
                        const data = chart.data;
                        if (data.labels.length && data.datasets.length) {
                            const dataset = data.datasets[0];
                            const total = dataset.data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = dataset.data[i];
                                const percentage = ((value / total) * 100).toFixed(1);
                                const formattedValue = new Intl.NumberFormat('es-ES', {
                                    style: 'currency',
                                    currency: 'EUR'
                                }).format(value);
                                
                                return {
                                    text: `${label}: ${formattedValue} (${percentage}%)`,
                                    fillStyle: dataset.backgroundColor[i],
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: dataset.borderWidth,
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 14,
                    titleFont: {
                        size: 15,
                        weight: 'bold',
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    bodyFont: {
                        size: 14,
                        weight: '500',
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            
                            return `${label}: ${new Intl.NumberFormat('es-ES', {
                                style: 'currency',
                                currency: 'EUR'
                            }).format(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
    
    // Forzar actualización de resolución después de crear el gráfico
    if (window.devicePixelRatio && expensesChart) {
        expensesChart.resize();
    }
}

// Calcular gastos por fecha
function calculateExpensesByDate() {
    const expensesByDate = {};
    
    transactions.forEach(transaction => {
        if (transaction.tipo === 'gasto' && transaction.importe < 0) {
            const fecha = transaction.fecha;
            const amount = Math.abs(transaction.importe);
            
            if (!expensesByDate[fecha]) {
                expensesByDate[fecha] = 0;
            }
            expensesByDate[fecha] += amount;
        }
    });
    
    const sortedDates = Object.keys(expensesByDate).sort((a, b) => {
        const dateA = parseDate(a);
        const dateB = parseDate(b);
        return dateA - dateB;
    });
    
    return {
        dates: sortedDates,
        amounts: sortedDates.map(date => expensesByDate[date])
    };
}

// Calcular saldo por fecha
function calculateBalanceByDate() {
    // Ordenar transacciones por fecha
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = parseDate(a.fecha);
        const dateB = parseDate(b.fecha);
        return dateA - dateB;
    });
    
    // Si hay saldos en las transacciones, usarlos
    // Si no, calcular el saldo acumulativo
    let currentBalance = 0;
    const balanceByDate = {};
    const dates = [];
    const balances = [];
    
    // Primero, verificar si hay saldos disponibles
    const hasSaldo = sortedTransactions.some(t => t.saldo !== null && t.saldo !== undefined);
    
    if (hasSaldo) {
        // Usar saldos del PDF
        sortedTransactions.forEach(transaction => {
            if (transaction.saldo !== null && transaction.saldo !== undefined) {
                if (!balanceByDate[transaction.fecha]) {
                    balanceByDate[transaction.fecha] = transaction.saldo;
                    dates.push(transaction.fecha);
                    balances.push(transaction.saldo);
                }
            }
        });
    } else {
        // Calcular saldo acumulativo
        sortedTransactions.forEach(transaction => {
            currentBalance += transaction.importe;
            if (!balanceByDate[transaction.fecha]) {
                balanceByDate[transaction.fecha] = currentBalance;
                dates.push(transaction.fecha);
                balances.push(currentBalance);
            } else {
                // Si hay múltiples transacciones en la misma fecha, actualizar el saldo
                balanceByDate[transaction.fecha] = currentBalance;
                const index = dates.indexOf(transaction.fecha);
                if (index !== -1) {
                    balances[index] = currentBalance;
                }
            }
        });
    }
    
    return {
        dates: dates,
        balances: balances
    };
}

// Actualizar gráfico temporal del saldo
function updateBalanceTimeChart() {
    const { dates, balances } = calculateBalanceByDate();
    
    if (dates.length === 0) {
        if (balanceTimeChart) {
            balanceTimeChart.destroy();
            balanceTimeChart = null;
        }
        return;
    }
    
    const formattedDates = dates.map(fecha => {
        const [day, month] = fecha.split('/');
        return `${day}/${month}`;
    });
    
    const ctx = document.getElementById('balanceTimeChart');
    if (!ctx) return;
    
    if (balanceTimeChart) {
        balanceTimeChart.destroy();
    }
    
    // Configurar alta resolución para el canvas
    const dprBalance = Math.max(window.devicePixelRatio || 1, 1);
    
    balanceTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: formattedDates,
            datasets: [{
                label: 'Saldo (€)',
                data: balances,
                borderColor: '#38a169',
                backgroundColor: 'rgba(56, 161, 105, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#38a169',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#2f855a',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: dprBalance,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 15,
                            weight: 'bold',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 14,
                    titleFont: {
                        size: 15,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14,
                        weight: '500'
                    },
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return dates[index];
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            return `Saldo: ${new Intl.NumberFormat('es-ES', {
                                style: 'currency',
                                currency: 'EUR'
                            }).format(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Fecha',
                        font: {
                            size: 13,
                            weight: 'bold',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: { top: 10, bottom: 0 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        padding: 8
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Saldo (€)',
                        font: {
                            size: 15,
                            weight: 'bold',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: { top: 0, bottom: 12 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: 8,
                        callback: function(value) {
                            return new Intl.NumberFormat('es-ES', {
                                style: 'currency',
                                currency: 'EUR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            }).format(value);
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Actualizar gráfico temporal
function updateExpensesTimeChart() {
    const { dates, amounts } = calculateExpensesByDate();
    
    if (dates.length === 0) {
        if (expensesTimeChart) {
            expensesTimeChart.destroy();
            expensesTimeChart = null;
        }
        return;
    }
    
    const formattedDates = dates.map(fecha => {
        const [day, month] = fecha.split('/');
        return `${day}/${month}`;
    });
    
    const ctx = document.getElementById('expensesTimeChart');
    if (!ctx) return;
    
    if (expensesTimeChart) {
        expensesTimeChart.destroy();
    }
    
    // Configurar alta resolución para el canvas
    const dprTime = Math.max(window.devicePixelRatio || 1, 1);
    
    expensesTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: formattedDates,
            datasets: [{
                label: 'Gastos (€)',
                data: amounts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#764ba2',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: dprTime,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 15,
                            weight: 'bold',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 14,
                    titleFont: {
                        size: 15,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14,
                        weight: '500'
                    },
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return dates[index];
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            return `Gastos: ${new Intl.NumberFormat('es-ES', {
                                style: 'currency',
                                currency: 'EUR'
                            }).format(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Fecha',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        padding: { top: 10, bottom: 0 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        padding: 8
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Importe (€)',
                        font: {
                            size: 15,
                            weight: 'bold',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: { top: 0, bottom: 12 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '600',
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        padding: 8,
                        callback: function(value) {
                            return new Intl.NumberFormat('es-ES', {
                                style: 'currency',
                                currency: 'EUR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            }).format(value);
                        }
                    },
                    beginAtZero: true
                }
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Calcular datos para Sankey (solo categorías, sin fechas)
function calculateSankeyData() {
    const categoryTotals = {};
    let totalGastos = 0;
    
    transactions.forEach(transaction => {
        if (transaction.tipo === 'gasto' && transaction.importe < 0) {
            const categoria = transaction.categoria || 'Otros';
            const amount = Math.abs(transaction.importe);
            totalGastos += amount;
            
            if (!categoryTotals[categoria]) {
                categoryTotals[categoria] = 0;
            }
            categoryTotals[categoria] += amount;
        }
    });
    
    // Ordenar categorías por cantidad
    const categorias = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);
    
    // Crear nodos: "Gastos Totales" -> cada categoría
    const nodes = [
        { label: 'Gastos Totales' },
        ...categorias.map(cat => ({ label: cat }))
    ];
    
    // Crear enlaces desde "Gastos Totales" hacia cada categoría
    const links = categorias.map((cat, index) => ({
        source: 0, // Índice de "Gastos Totales"
        target: index + 1, // Índice de la categoría
        value: categoryTotals[cat]
    }));
    
    return { nodes, links, categorias, totalGastos };
}


// Actualizar diagrama Sankey
function updateSankeyChart() {
    if (typeof Plotly === 'undefined') {
        console.error('Plotly no está cargado');
        return;
    }
    
    const { nodes, links, categorias, totalGastos } = calculateSankeyData();
    
    if (nodes.length <= 1 || links.length === 0) {
        const container = document.getElementById('sankeyChart');
        if (container) {
            container.innerHTML = '';
        }
        sankeyChart = null;
        return;
    }
    
    const container = document.getElementById('sankeyChart');
    if (!container) return;
    
    const nodeLabels = nodes.map(node => node.label);
    
    // Color para "Gastos Totales" y colores de categorías
    const nodeColors = nodes.map((node, index) => {
        if (index === 0) {
            return '#667eea'; // Color para "Gastos Totales"
        }
        return getCategoryColor(node.label);
    });
    
    const linkSources = links.map(link => link.source);
    const linkTargets = links.map(link => link.target);
    const linkValues = links.map(link => link.value);
    
    // Colores de enlaces basados en la categoría de destino
    const linkColors = links.map(link => {
        const targetColor = nodeColors[link.target];
        if (targetColor.startsWith('#')) {
            const r = parseInt(targetColor.slice(1, 3), 16);
            const g = parseInt(targetColor.slice(3, 5), 16);
            const b = parseInt(targetColor.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, 0.8)`;
        }
        return targetColor || '#667eea';
    });
    
    const data = {
        type: 'sankey',
        orientation: 'h',
        node: {
            pad: 20,
            thickness: 30,
            line: {
                color: 'rgba(0, 0, 0, 0.2)',
                width: 0.5
            },
            label: nodeLabels,
            color: nodeColors
        },
        link: {
            source: linkSources,
            target: linkTargets,
            value: linkValues,
            color: linkColors,
            hovertemplate: '%{source.label} → %{target.label}<br>Importe: %{value:,.2f} € (%{percentParent:.1%})<extra></extra>'
        }
    };
    
    const layout = {
        title: {
            text: '',
            font: {
                size: 16
            }
        },
        font: {
            size: 13,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        paper_bgcolor: 'rgba(255,255,255,0)',
        plot_bgcolor: 'rgba(255,255,255,0)',
        margin: {
            l: 60,
            r: 60,
            t: 20,
            b: 20
        },
        height: 500
    };
    
    const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        staticPlot: false
    };
    
    // Limpiar contenedor antes de crear nuevo gráfico
    container.innerHTML = '';
    container.style.pointerEvents = 'auto';
    container.style.position = 'relative';
    container.style.zIndex = '1';
    
    if (sankeyChart) {
        Plotly.purge(container);
    }
    
    Plotly.newPlot(container, [data], layout, config);
    sankeyChart = container;
}

// Exportar a Excel
exportExcelBtn.addEventListener('click', () => {
    if (transactions.length === 0) {
        alert('No hay transacciones para exportar');
        return;
    }
    
    try {
        // Crear un libro de trabajo
        const wb = XLSX.utils.book_new();
        
        // Preparar los datos
        const headers = ['Fecha', 'Concepto', 'Detalle', 'Importe', 'Tipo', 'Categoría'];
        const data = transactions.map(t => [
            t.fecha,
            t.concepto,
            t.detalle,
            t.importe,
            t.tipo,
            t.categoria || 'Otros'
        ]);
        
        // Crear la hoja de trabajo con encabezados y datos
        const wsData = [headers, ...data];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Ajustar el ancho de las columnas
        ws['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 25 }, // Concepto
            { wch: 40 }, // Detalle
            { wch: 12 }, // Importe
            { wch: 10 }, // Tipo
            { wch: 15 }  // Categoría
        ];
        
        // Añadir la hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');
        
        // Generar el nombre del archivo con la fecha actual
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `extracto_bancario_${dateStr}.xlsx`;
        
        // Escribir el archivo
        XLSX.writeFile(wb, fileName);
        
        console.log('Archivo Excel exportado exitosamente');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al exportar a Excel: ' + error.message);
    }
});

// Exportar a CSV
exportBtn.addEventListener('click', () => {
    if (transactions.length === 0) {
        alert('No hay transacciones para exportar');
        return;
    }
    
    const headers = ['Fecha', 'Concepto', 'Detalle', 'Importe', 'Tipo', 'Categoría'];
    const csvContent = [
        headers.join(','),
        ...transactions.map(t => [
            t.fecha,
            `"${t.concepto.replace(/"/g, '""')}"`,
            `"${t.detalle.replace(/"/g, '""')}"`,
            t.importe,
            t.tipo,
            `"${(t.categoria || 'Otros').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'extracto_bancario.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Limpiar resultados
clearBtn.addEventListener('click', () => {
    transactions = [];
    transactionsBody.innerHTML = '';
    results.classList.add('hidden');
    debug.classList.add('hidden');
    debugContent.classList.add('hidden');
    fileName.textContent = '';
    pdfInput.value = '';
    extractedText = '';
    
    if (expensesChart) {
        expensesChart.destroy();
        expensesChart = null;
    }
    if (expensesTimeChart) {
        expensesTimeChart.destroy();
        expensesTimeChart = null;
    }
    if (balanceTimeChart) {
        balanceTimeChart.destroy();
        balanceTimeChart = null;
    }
    if (sankeyChart) {
        const container = document.getElementById('sankeyChart');
        if (container) {
            Plotly.purge(container);
        }
        sankeyChart = null;
    }
});

// Limpiar clasificaciones aprendidas
clearLearnedBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres eliminar todas las clasificaciones aprendidas? Esto no se puede deshacer.')) {
        localStorage.removeItem('learnedClassifications');
        alert('Clasificaciones aprendidas eliminadas. Recarga el PDF para ver los cambios.');
        if (transactions.length > 0) {
            displayTransactions(transactions);
        }
    }
});

// Cargar API key de OpenAI desde localStorage
function loadOpenAIKey() {
    try {
        let saved = localStorage.getItem('openaiApiKey');
        
        // Si no hay API key guardada, guardar la del servidor como respaldo
        // (solo si no hay servidor disponible)
        if (!saved) {
            // La API key del servidor está protegida, pero podemos usarla como fallback
            // En este caso, guardaremos una copia en localStorage solo si el servidor no está disponible
            console.log('No hay API key en localStorage');
        }
        
        if (saved && openaiApiKeyInput) {
            openaiApiKeyInput.value = saved;
        }
    } catch (e) {
        console.error('Error cargando API key:', e);
    }
}

// Función para asegurar que haya una API key disponible
function ensureApiKeyAvailable() {
    try {
        let apiKey = localStorage.getItem('openaiApiKey');
        
        // Si no hay API key y no hay servidor, mostrar instrucciones
        if (!apiKey && (!useServer || !authToken)) {
            console.warn('⚠️ No hay API key disponible. Guarda tu API key de OpenAI en localStorage.');
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('Error verificando API key:', e);
        return false;
    }
}

// Guardar API key de OpenAI
saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = openaiApiKeyInput.value.trim();
    if (!apiKey) {
        alert('Por favor, introduce una API key válida');
        return;
    }
    if (!apiKey.startsWith('sk-')) {
        if (!confirm('La API key no parece válida (debe empezar con "sk-"). ¿Deseas guardarla de todas formas?')) {
            return;
        }
    }
    try {
        localStorage.setItem('openaiApiKey', apiKey);
        alert('API key guardada correctamente');
        openaiApiKeyInput.type = 'password';
    } catch (e) {
        console.error('Error guardando API key:', e);
        alert('Error al guardar la API key');
    }
});

// Limpiar API key
clearApiKeyBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres eliminar la API key guardada?')) {
        openaiApiKeyInput.value = '';
        localStorage.removeItem('openaiApiKey');
        alert('API key eliminada');
    }
});

// Cargar API key al iniciar
loadOpenAIKey();

// Clasificar transacciones con OpenAI (SOLO usa el servidor - API key protegida)
async function classifyWithOpenAI(transaction) {
    // Verificar que el servidor esté disponible y autenticado
    if (!useServer || !authToken) {
        throw new Error('El servidor no está disponible o no estás autenticado. Inicia sesión para usar la clasificación con IA.');
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/classify-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                transaction: transaction,
                categorias: CATEGORIAS
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.categoria) {
                return data.categoria;
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Respuesta inválida del servidor');
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `Error del servidor: ${response.status}`;
            console.error('Error HTTP del servidor:', response.status, errorMsg);
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ Error clasificando con servidor:', error.message || error);
        throw error;
    }
}

// Clasificar todas las transacciones con IA
classifyWithAIBtn.addEventListener('click', async () => {
    if (transactions.length === 0) {
        alert('No hay transacciones para clasificar');
        return;
    }

    // Verificar que el servidor esté disponible y autenticado
    if (!useServer || !authToken) {
        alert('❌ Para usar la clasificación con IA necesitas:\n\n' +
              '1. Tener el servidor Node.js corriendo\n' +
              '2. Iniciar sesión en la aplicación\n\n' +
              'La API key está protegida en el servidor y no se puede usar sin él.');
        return;
    }
    
    console.log('✅ Usando servidor para clasificación con IA (modo seguro)');

    // Deshabilitar botón durante el proceso
    classifyWithAIBtn.disabled = true;
    aiStatus.classList.remove('hidden');
    aiStatus.className = 'ai-status loading';
    aiStatus.textContent = `Clasificando transacciones con IA... 0/${transactions.length}`;

    let processed = 0;
    let errors = 0;
    const batchSize = 5; // Procesar en lotes para no saturar la API

    try {
        // Procesar transacciones en lotes
        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, Math.min(i + batchSize, transactions.length));
            
            const promises = batch.map(async (transaction) => {
                try {
                    // Solo clasificar si no tiene una clasificación aprendida
                    const learnedCat = findLearnedClassification(transaction.detalle, transaction.concepto);
                    if (learnedCat) {
                        transaction.categoria = learnedCat;
                        processed++;
                        aiStatus.textContent = `Clasificando transacciones con IA... ${processed}/${transactions.length}`;
                        // Pequeña pausa incluso para clasificaciones aprendidas
                        await new Promise(resolve => setTimeout(resolve, 50));
                        return;
                    }

                    const categoria = await classifyWithOpenAI(transaction);
                    transaction.categoria = categoria;
                    
                    // Guardar la clasificación aprendida
                    await saveClassification(transaction.detalle, transaction.concepto, categoria);
                    
                    processed++;
                    aiStatus.textContent = `Clasificando transacciones con IA... ${processed}/${transactions.length}`;
                    
                    // Pequeña pausa entre transacciones para evitar rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    errors++;
                    console.error(`Error clasificando transacción "${transaction.detalle}":`, error.message || error);
                    // Mantener la categoría actual o usar clasificación automática
                    if (!transaction.categoria) {
                        transaction.categoria = classifyTransaction(transaction);
                    }
                    // Pausa incluso en caso de error
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            });

            await Promise.all(promises);
            
            // Pausa entre lotes
            if (i + batchSize < transactions.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Actualizar la visualización
        displayTransactions(transactions);

        // Mostrar resultado
        if (errors === 0) {
            aiStatus.className = 'ai-status success';
            aiStatus.textContent = `✓ Clasificación completada: ${processed} transacciones procesadas`;
        } else {
            aiStatus.className = 'ai-status error';
            const totalTransactions = transactions.length;
            aiStatus.textContent = `⚠ Clasificación completada con ${errors} errores: ${processed}/${totalTransactions} transacciones procesadas`;
            
            // Mostrar mensaje de ayuda si todos fallaron
            if (processed === 0 && errors === totalTransactions) {
                console.error('🚨 TODAS las transacciones fallaron. Posibles causas:');
                console.error('- useServer:', useServer);
                console.error('- authToken:', !!authToken);
                
                if (!useServer || !authToken) {
                    alert('❌ Error: No se pudo clasificar ninguna transacción.\n\n' +
                          'Causa: El servidor no está disponible o no estás autenticado.\n\n' +
                          'Solución:\n' +
                          '1. Asegúrate de que el servidor Node.js esté corriendo\n' +
                          '2. Inicia sesión en la aplicación\n' +
                          '3. Verifica que el servidor esté accesible');
                } else {
                    alert('❌ Error: No se pudo clasificar ninguna transacción.\n\n' +
                          'Posibles causas:\n' +
                          '1. Problema con la API key de OpenAI en el servidor\n' +
                          '2. Problemas de conexión a internet\n' +
                          '3. Límite de rate de OpenAI alcanzado\n\n' +
                          'Revisa la consola del servidor para más detalles.');
                }
            }
        }

        // Ocultar el estado después de 5 segundos
        setTimeout(() => {
            aiStatus.classList.add('hidden');
        }, 5000);

    } catch (error) {
        console.error('Error en la clasificación con IA:', error);
        aiStatus.className = 'ai-status error';
        aiStatus.textContent = `Error: ${error.message}`;
    } finally {
        classifyWithAIBtn.disabled = false;
    }
});

// Mostrar error
function showError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
}

// Ocultar error
function hideError() {
    error.classList.add('hidden');
}

