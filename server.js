// Cargar variables de entorno PRIMERO
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// CREAR ARCHIVO DE LOG INMEDIATAMENTE (antes de cualquier otra cosa)
// Intentar múltiples ubicaciones para asegurar que se cree
let logStream;
const logPaths = ['./runtime.log', './server.log', './app.log'];

for (const logPath of logPaths) {
    try {
        logStream = fs.createWriteStream(logPath, { flags: 'w' });
        logStream.write(`[START] ${new Date().toISOString()} === Iniciando aplicación ===\n`);
        logStream.write(`[START] ${new Date().toISOString()} Directorio: ${__dirname}\n`);
        logStream.write(`[START] ${new Date().toISOString()} Node version: ${process.version}\n`);
        logStream.write(`[START] ${new Date().toISOString()} Puerto: ${process.env.PORT || 3000}\n`);
        logStream.write(`[START] ${new Date().toISOString()} Host: ${process.env.HOST || '0.0.0.0'}\n`);
        console.log(`✅ Log creado en: ${logPath}`);
        break; // Si funcionó, usar este
    } catch (logError) {
        console.error(`Error creando log en ${logPath}:`, logError.message);
        continue; // Intentar siguiente ubicación
    }
}

// También crear un archivo de diagnóstico simple (más fácil de ver)
try {
    fs.writeFileSync('./server-status.txt', `Servidor iniciando: ${new Date().toISOString()}\nDirectorio: ${__dirname}\nNode: ${process.version}\n`);
} catch (e) {
    console.error('Error creando server-status.txt:', e.message);
}

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');

function writeLog(level, message) {
    try {
        const timestamp = new Date().toISOString();
        const logMessage = `[${level}] ${timestamp} ${message}\n`;
        if (logStream) {
            logStream.write(logMessage);
        }
        // También mostrar en consola si está disponible
        if (level === 'ERROR' || level === 'UNCAUGHT' || level === 'UNHANDLED') {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
    } catch (e) {
        // Si falla escribir en log, al menos mostrar en consola
        console.error('Error escribiendo en log:', e);
    }
}

// Capturar errores no manejados ANTES de que se inicie la app
process.on('uncaughtException', (err) => {
    try {
        writeLog('UNCAUGHT', `Excepción no capturada: ${err.message}\n${err.stack}`);
    } catch (e) {
        console.error('Error fatal:', err);
    }
    if (logStream) {
        logStream.end();
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    try {
        writeLog('UNHANDLED', `Promesa rechazada no manejada: ${reason}\n${reason?.stack || ''}`);
    } catch (e) {
        console.error('Promesa rechazada:', reason);
    }
});

// Redirigir console.log y console.error a archivo también
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    writeLog('LOG', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    originalLog(...args);
};

console.error = (...args) => {
    writeLog('ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    originalError(...args);
};

writeLog('INFO', '=== Iniciando servidor ===');
writeLog('INFO', `Directorio de trabajo: ${__dirname}`);
writeLog('INFO', `Node version: ${process.version}`);
writeLog('INFO', `Puerto: ${process.env.PORT || 3000}`);
writeLog('INFO', `Host: ${process.env.HOST || '0.0.0.0'}`);

// Usar fetch nativo si está disponible (Node.js 18+), sino usar node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
    console.log('✅ Usando fetch nativo de Node.js');
} else {
    try {
        fetch = require('node-fetch');
        console.log('✅ Usando node-fetch');
    } catch (e) {
        console.error('❌ Error: No se pudo cargar fetch ni node-fetch');
        throw new Error('Se requiere Node.js 18+ o node-fetch instalado');
    }
}

const app = express();

// En Hostinger, el puerto DEBE venir de process.env.PORT (no usar default)
// Hostinger proporciona automáticamente esta variable
const PORT = process.env.PORT || 3000;

// IMPORTANTE: En Hostinger, verificar que PORT existe
if (!process.env.PORT && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ ADVERTENCIA: process.env.PORT no está definido en producción. Hostinger debería proporcionarlo automáticamente.');
}

// API Key de OpenAI - NUNCA se expone al cliente
// Obtener de variable de entorno o usar valor por defecto (para desarrollo local)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

if (!OPENAI_API_KEY || OPENAI_API_KEY === 'tu_api_key_aqui') {
    console.error('⚠️  ADVERTENCIA: OPENAI_API_KEY no configurada. Configúrala en el archivo .env o como variable de entorno.');
}

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (CSS, JS, imágenes, etc.)
// IMPORTANTE: En Hostinger, los archivos estáticos deben servirse explícitamente
app.use(express.static(__dirname, {
    index: false, // No usar index.html automáticamente, lo servimos manualmente
    dotfiles: 'ignore', // Ignorar archivos ocultos como .env
    extensions: ['html', 'css', 'js', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'woff', 'woff2', 'ttf', 'eot'],
    setHeaders: (res, path) => {
        // Asegurar que los archivos CSS y JS tengan los headers correctos
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Servir archivos estáticos específicos explícitamente (por si acaso)
app.get('*.css', (req, res, next) => {
    res.type('text/css');
    next();
});

app.get('*.js', (req, res, next) => {
    res.type('application/javascript');
    next();
});

writeLog('INFO', 'Intentando conectar a base de datos SQLite...');

// Inicializar base de datos
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        writeLog('ERROR', `Error abriendo base de datos: ${err.message}\n${err.stack}`);
        console.error('Error abriendo base de datos:', err);
    } else {
        writeLog('INFO', '✅ Conectado a SQLite');
        console.log('Conectado a SQLite');
        initializeDatabase();
    }
});

// Inicializar tablas
function initializeDatabase() {
    // Tabla de usuarios
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creando tabla users:', err);
    });

    // Tabla de historial de PDFs
    db.run(`CREATE TABLE IF NOT EXISTS pdf_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        transaction_count INTEGER NOT NULL,
        transactions TEXT NOT NULL,
        total_income REAL NOT NULL,
        total_expenses REAL NOT NULL,
        final_balance REAL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error('Error creando tabla pdf_history:', err);
    });

    // Tabla de clasificaciones aprendidas (por usuario)
    db.run(`CREATE TABLE IF NOT EXISTS learned_classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        search_text TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, search_text),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error('Error creando tabla learned_classifications:', err);
    });

    // Crear usuario admin por defecto
    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin123';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    
    db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, row) => {
        if (!row) {
            db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
                [adminEmail, hashedPassword], (err) => {
                    if (err) {
                        console.error('Error creando usuario admin:', err);
                    } else {
                        console.log('Usuario admin creado:', adminEmail);
                    }
                });
        }
    });
}

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Verificar token (en producción usar JWT)
    db.get('SELECT * FROM users WHERE id = ?', [token], (err, user) => {
        if (err || !user) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// API Routes

// Registrar nuevo usuario
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
            [email.toLowerCase(), hashedPassword], 
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Este email ya está registrado' });
                    }
                    return res.status(500).json({ error: 'Error al registrar usuario' });
                }

                res.json({ 
                    success: true, 
                    message: 'Usuario registrado exitosamente',
                    userId: this.lastID 
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Error en el servidor' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Email o contraseña incorrectos' });
            }

            if (!bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ error: 'Email o contraseña incorrectos' });
            }

            // En producción, usar JWT. Por simplicidad, usamos el user ID como token
            res.json({ 
                success: true, 
                token: user.id.toString(),
                email: user.email,
                isAdmin: user.email.toLowerCase() === 'admin@admin.com'
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Guardar historial de PDF
app.post('/api/pdf-history', authenticateToken, (req, res) => {
    try {
        const { fileName, transactions, totalIncome, totalExpenses, finalBalance } = req.body;

        if (!fileName || !transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        const transactionCount = transactions.length;

        db.run(`INSERT INTO pdf_history 
                (user_id, file_name, transaction_count, transactions, total_income, total_expenses, final_balance) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                fileName,
                transactionCount,
                JSON.stringify(transactions),
                totalIncome || 0,
                totalExpenses || 0,
                finalBalance
            ],
            function(err) {
                if (err) {
                    console.error('Error guardando historial:', err);
                    return res.status(500).json({ error: 'Error al guardar historial' });
                }

                res.json({ 
                    success: true, 
                    id: this.lastID,
                    message: 'Historial guardado exitosamente' 
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener historial de PDFs del usuario
app.get('/api/pdf-history', authenticateToken, (req, res) => {
    try {
        db.all(`SELECT id, file_name, timestamp, transaction_count, 
                       total_income, total_expenses, final_balance 
                FROM pdf_history 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1000`,
            [req.user.id],
            (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener historial' });
                }

                const history = rows.map(row => ({
                    id: row.id,
                    fileName: row.file_name,
                    timestamp: row.timestamp,
                    transactionCount: row.transaction_count,
                    totalIncome: row.total_income,
                    totalExpenses: row.total_expenses,
                    finalBalance: row.final_balance,
                    userEmail: req.user.email
                }));

                res.json({ success: true, history });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener detalles de un PDF específico
app.get('/api/pdf-history/:id', authenticateToken, (req, res) => {
    try {
        const pdfId = req.params.id;

        db.get(`SELECT * FROM pdf_history 
                WHERE id = ? AND user_id = ?`,
            [pdfId, req.user.id],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener detalles' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'PDF no encontrado' });
                }

                res.json({
                    success: true,
                    pdf: {
                        id: row.id,
                        fileName: row.file_name,
                        timestamp: row.timestamp,
                        transactionCount: row.transaction_count,
                        transactions: JSON.parse(row.transactions),
                        totalIncome: row.total_income,
                        totalExpenses: row.total_expenses,
                        finalBalance: row.final_balance,
                        userEmail: req.user.email
                    }
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Panel de administración - Obtener todas las estadísticas
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    try {
        if (req.user.email.toLowerCase() !== 'admin@admin.com') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Total de usuarios
        db.get('SELECT COUNT(*) as total FROM users', [], (err, userCount) => {
            if (err) {
                return res.status(500).json({ error: 'Error al obtener estadísticas' });
            }

            // Total de PDFs
            db.get('SELECT COUNT(*) as total FROM pdf_history', [], (err, pdfCount) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener estadísticas' });
                }

                // Total de transacciones
                db.get('SELECT SUM(transaction_count) as total FROM pdf_history', [], (err, transactionCount) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error al obtener estadísticas' });
                    }

                    // Totales de ingresos y gastos
                    db.get('SELECT SUM(total_income) as income, SUM(total_expenses) as expenses FROM pdf_history', [], (err, totals) => {
                        if (err) {
                            return res.status(500).json({ error: 'Error al obtener estadísticas' });
                        }

                        res.json({
                            success: true,
                            stats: {
                                totalUsers: userCount.total,
                                totalPdfs: pdfCount.total,
                                totalTransactions: transactionCount.total || 0,
                                totalIncome: totals.income || 0,
                                totalExpenses: totals.expenses || 0
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Panel de administración - Obtener todos los PDFs
app.get('/api/admin/pdf-history', authenticateToken, (req, res) => {
    try {
        if (req.user.email.toLowerCase() !== 'admin@admin.com') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        db.all(`SELECT ph.id, ph.file_name, ph.timestamp, ph.transaction_count,
                       ph.total_income, ph.total_expenses, ph.final_balance,
                       u.email as user_email
                FROM pdf_history ph
                JOIN users u ON ph.user_id = u.id
                ORDER BY ph.timestamp DESC
                LIMIT 1000`,
            [],
            (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener historial' });
                }

                const history = rows.map(row => ({
                    id: row.id,
                    fileName: row.file_name,
                    timestamp: row.timestamp,
                    transactionCount: row.transaction_count,
                    totalIncome: row.total_income,
                    totalExpenses: row.total_expenses,
                    finalBalance: row.final_balance,
                    userEmail: row.user_email
                }));

                res.json({ success: true, history });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Panel de administración - Obtener detalles de PDF (cualquier usuario)
app.get('/api/admin/pdf-history/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.email.toLowerCase() !== 'admin@admin.com') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const pdfId = req.params.id;

        db.get(`SELECT ph.*, u.email as user_email
                FROM pdf_history ph
                JOIN users u ON ph.user_id = u.id
                WHERE ph.id = ?`,
            [pdfId],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener detalles' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'PDF no encontrado' });
                }

                res.json({
                    success: true,
                    pdf: {
                        id: row.id,
                        fileName: row.file_name,
                        timestamp: row.timestamp,
                        transactionCount: row.transaction_count,
                        transactions: JSON.parse(row.transactions),
                        totalIncome: row.total_income,
                        totalExpenses: row.total_expenses,
                        finalBalance: row.final_balance,
                        userEmail: row.user_email
                    }
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Panel de administración - Obtener lista de usuarios
app.get('/api/admin/users', authenticateToken, (req, res) => {
    try {
        if (req.user.email.toLowerCase() !== 'admin@admin.com') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        db.all('SELECT id, email, created_at FROM users ORDER BY created_at DESC',
            [],
            (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener usuarios' });
                }

                res.json({ success: true, users: rows });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Guardar clasificación aprendida
app.post('/api/learned-classification', authenticateToken, (req, res) => {
    try {
        const { searchText, category } = req.body;

        if (!searchText || !category) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        db.run(`INSERT OR REPLACE INTO learned_classifications (user_id, search_text, category) 
                VALUES (?, ?, ?)`,
            [req.user.id, searchText.toLowerCase().trim(), category],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al guardar clasificación' });
                }

                res.json({ success: true });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener clasificaciones aprendidas del usuario
app.get('/api/learned-classifications', authenticateToken, (req, res) => {
    try {
        db.all('SELECT search_text, category FROM learned_classifications WHERE user_id = ?',
            [req.user.id],
            (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al obtener clasificaciones' });
                }

                const classifications = {};
                rows.forEach(row => {
                    classifications[row.search_text] = row.category;
                });

                res.json({ success: true, classifications });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Limpiar clasificaciones aprendidas del usuario
app.delete('/api/learned-classifications', authenticateToken, (req, res) => {
    try {
        db.run('DELETE FROM learned_classifications WHERE user_id = ?',
            [req.user.id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al limpiar clasificaciones' });
                }

                res.json({ success: true });
            });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Endpoint para clasificar transacciones con IA (seguro - API key en servidor)
app.post('/api/classify-transaction', authenticateToken, async (req, res) => {
    try {
        const { transaction, categorias } = req.body;

        console.log('📥 Petición de clasificación recibida:', {
            concepto: transaction?.concepto,
            detalle: transaction?.detalle?.substring(0, 50),
            categoriasCount: categorias?.length
        });

        if (!transaction) {
            console.error('❌ Error: Transacción no proporcionada');
            return res.status(400).json({ error: 'Transacción requerida' });
        }

        const prompt = `Clasifica la siguiente transacción bancaria en UNA de estas categorías: ${(categorias || []).join(', ')}.

Transacción:
- Concepto: ${transaction.concepto}
- Detalle: ${transaction.detalle}
- Importe: ${transaction.importe} €
- Tipo: ${transaction.tipo}

Responde SOLO con el nombre de la categoría, sin explicaciones ni texto adicional.`;

        console.log('🔄 Enviando petición a OpenAI...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un asistente experto en clasificar transacciones bancarias. Responde SOLO con el nombre de la categoría.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 20
            })
        });

        console.log('📥 Respuesta de OpenAI - Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error de OpenAI API:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(errorData.error?.message || `Error de API: ${response.status}`);
        }

        const data = await response.json();
        
        console.log('✅ Respuesta de OpenAI recibida:', {
            hasChoices: !!data.choices,
            choicesLength: data.choices?.length,
            content: data.choices?.[0]?.message?.content?.substring(0, 50)
        });
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ Respuesta inválida de OpenAI:', JSON.stringify(data, null, 2));
            throw new Error('Respuesta inválida de OpenAI');
        }
        
        const categoria = data.choices[0].message.content?.trim();
        
        if (!categoria) {
            console.error('❌ Categoría vacía en respuesta de OpenAI:', JSON.stringify(data, null, 2));
            throw new Error('No se recibió categoría de OpenAI');
        }
        
        console.log('📋 Categoría recibida:', categoria);
        
        // Validar que la categoría sea una de las permitidas
        const categoriasList = categorias || [];
        if (!categoria || !categoriasList.includes(categoria)) {
            // Intentar encontrar la categoría más cercana
            const categoriaLower = categoria.toLowerCase();
            const found = categoriasList.find(cat => 
                cat.toLowerCase() === categoriaLower ||
                cat.toLowerCase().includes(categoriaLower) ||
                categoriaLower.includes(cat.toLowerCase())
            );
            const categoriaFinal = found || 'Otros';
            console.log('🔄 Categoría ajustada:', categoria, '->', categoriaFinal);
            return res.json({ success: true, categoria: categoriaFinal });
        }
        
        console.log('✅ Clasificación exitosa:', categoria);
        res.json({ success: true, categoria });
    } catch (error) {
        console.error('❌ Error clasificando con OpenAI:', error.message || error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: error.message || 'Error al clasificar transacción' });
    }
});

// Endpoint para ver logs del servidor (para debugging en Hostinger)
app.get('/api/logs', (req, res) => {
    try {
        // Intentar leer runtime.log primero
        const runtimeLogPath = path.join(__dirname, 'runtime.log');
        const serverLogPath = path.join(__dirname, 'server.log');
        
        if (fs.existsSync(runtimeLogPath)) {
            try {
                const logs = fs.readFileSync(runtimeLogPath, 'utf8');
                const lines = logs.split('\n').slice(-100); // Últimas 100 líneas
                res.json({ success: true, logs: lines.join('\n'), source: 'runtime.log' });
                return;
            } catch (readError) {
                writeLog('ERROR', `Error leyendo runtime.log: ${readError.message}`);
            }
        }
        
        if (fs.existsSync(serverLogPath)) {
            try {
                const logs = fs.readFileSync(serverLogPath, 'utf8');
                const lines = logs.split('\n').slice(-50); // Últimas 50 líneas
                res.json({ success: true, logs: lines.join('\n'), source: 'server.log' });
                return;
            } catch (readError) {
                writeLog('ERROR', `Error leyendo server.log: ${readError.message}`);
            }
        }
        
        // Si no hay archivos de log, devolver mensaje informativo (no error)
        res.json({ success: true, logs: 'No hay archivo de log aún. El servidor puede no haberse iniciado.', source: 'none' });
    } catch (error) {
        writeLog('ERROR', `Error en endpoint /api/logs: ${error.message}`);
        // En lugar de devolver 500, devolver un mensaje informativo
        res.json({ success: false, error: 'No se pudieron leer los logs', message: error.message });
    }
});

// Servir la aplicación
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        writeLog('INFO', `Solicitud GET / desde ${req.ip}`);
        writeLog('INFO', `Sirviendo index.html desde: ${indexPath}`);
        
        // Verificar que el archivo existe antes de servirlo
        if (!fs.existsSync(indexPath)) {
            writeLog('ERROR', `index.html no encontrado en: ${indexPath}`);
            return res.status(404).send('Error: index.html no encontrado. Verifica la estructura de archivos.');
        }
        
        res.sendFile(indexPath, (err) => {
            if (err) {
                writeLog('ERROR', `Error sirviendo index.html: ${err.message}`);
                res.status(500).send('Error cargando la aplicación. Verifica que index.html existe.');
            } else {
                writeLog('INFO', 'index.html enviado correctamente');
            }
        });
    } catch (error) {
        writeLog('ERROR', `Excepción sirviendo index.html: ${error.message}`);
        res.status(500).send('Error interno del servidor');
    }
});

// Ruta adicional para verificar que el servidor funciona (útil para debugging)
app.get('/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString(),
        port: PORT,
        host: HOST,
        directory: __dirname,
        files: fs.existsSync(path.join(__dirname, 'index.html')) ? 'index.html existe' : 'index.html NO existe'
    });
});

// Health check endpoint (para verificar que el servidor está corriendo)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        directory: __dirname,
        port: PORT,
        host: HOST,
        nodeVersion: process.version,
        envPort: process.env.PORT,
        envHost: process.env.HOST,
        envNodeEnv: process.env.NODE_ENV
    });
});

writeLog('INFO', '=== INICIANDO SERVIDOR EXPRESS ===');
console.log('═══════════════════════════════════════════════════════');
console.log('🚀 INICIANDO SERVIDOR EXPRESS...');
console.log('═══════════════════════════════════════════════════════');

// Iniciar servidor
// En Hostinger, el servidor debe escuchar en el puerto que asigne el servicio
// Hostinger normalmente proporciona PORT pero NO HOST, así que escuchamos en todas las interfaces
const HOST = process.env.HOST || '0.0.0.0';

writeLog('INFO', `Intentando iniciar servidor en ${HOST}:${PORT}...`);
writeLog('INFO', `process.env.PORT = ${process.env.PORT}`);
writeLog('INFO', `process.env.HOST = ${process.env.HOST}`);
writeLog('INFO', `process.env.NODE_ENV = ${process.env.NODE_ENV}`);

console.log(`📡 Puerto configurado: ${PORT} (process.env.PORT = ${process.env.PORT || 'NO DEFINIDO'})`);
console.log(`🌐 Host configurado: ${HOST} (process.env.HOST = ${process.env.HOST || 'NO DEFINIDO'})`);
console.log(`📁 Directorio: ${__dirname}`);
console.log(`🟢 Node version: ${process.version}`);
console.log('═══════════════════════════════════════════════════════');

// Manejo de errores al iniciar el servidor
let server;
// En Hostinger, si PORT no está definido, intentar usar el puerto 3000 como fallback
// Hostinger DEBE proporcionar process.env.PORT, pero si no lo hace, usamos 3000
const finalPort = PORT && PORT !== 'undefined' ? PORT : 3000;

if (!process.env.PORT) {
    writeLog('WARN', 'process.env.PORT no está definido. Usando puerto 3000 como fallback.');
    console.warn('⚠️ ADVERTENCIA: process.env.PORT no está definido. Usando puerto 3000.');
}

try {
    server = app.listen(finalPort, HOST, () => {
        writeLog('INFO', `🚀 Servidor ejecutándose correctamente en http://${HOST}:${finalPort}`);
        writeLog('INFO', `📁 Directorio: ${__dirname}`);
        writeLog('INFO', `✅ Archivos estáticos servidos desde: ${__dirname}`);
        writeLog('INFO', `✅ Servidor Node.js iniciado correctamente`);
        writeLog('INFO', `✅ Puerto: ${finalPort}, Host: ${HOST}`);
        writeLog('INFO', `✅ process.env.PORT: ${process.env.PORT || 'NO DEFINIDO'}`);
        
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ SERVIDOR INICIADO CORRECTAMENTE');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`🌐 URL: http://${HOST}:${finalPort}`);
        console.log(`📁 Directorio: ${__dirname}`);
        console.log(`📝 Logs guardándose en runtime.log`);
        console.log(`✅ Archivos estáticos servidos desde: ${__dirname}`);
        console.log(`✅ Puerto: ${finalPort}, Host: ${HOST}`);
        console.log(`✅ process.env.PORT: ${process.env.PORT || 'NO DEFINIDO'}`);
        console.log(`✅ Node Version: ${process.version}`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 Endpoints disponibles:');
        console.log(`   - GET  /          → Aplicación principal`);
        console.log(`   - GET  /health    → Estado del servidor`);
        console.log(`   - GET  /test      → Test del servidor`);
        console.log(`   - GET  /api/logs  → Ver logs del servidor`);
        console.log('═══════════════════════════════════════════════════════');
        
        // Actualizar archivo de estado (fácil de verificar en File Manager)
        try {
            fs.writeFileSync('./server-status.txt', 
                `✅ SERVIDOR CORRIENDO\n` +
                `Fecha: ${new Date().toISOString()}\n` +
                `Directorio: ${__dirname}\n` +
                `Puerto: ${finalPort}\n` +
                `process.env.PORT: ${process.env.PORT || 'NO DEFINIDO'}\n` +
                `Host: ${HOST}\n` +
                `URL: http://${HOST}:${finalPort}\n` +
                `Node Version: ${process.version}\n`
            );
        } catch (e) {
            console.error('Error actualizando server-status.txt:', e.message);
        }
    });

    // Manejo de errores del servidor
    server.on('error', (error) => {
        writeLog('ERROR', `Error al iniciar el servidor: ${error.message}\n${error.stack}`);
        if (error.code === 'EADDRINUSE') {
            writeLog('ERROR', `Puerto ${finalPort} ya está en uso. Intenta con otro puerto.`);
            console.error(`❌ Puerto ${finalPort} ya está en uso.`);
        } else {
            writeLog('ERROR', `Error: ${error.message}`);
            console.error('❌ Error al iniciar el servidor:', error.message);
        }
        if (logStream) logStream.end();
        process.exit(1);
    });
    
    writeLog('INFO', 'Servidor configurado correctamente, esperando conexiones...');
    
} catch (error) {
    writeLog('ERROR', `Error al configurar servidor: ${error.message}\n${error.stack}`);
    console.error('❌ Error al configurar servidor:', error);
    logStream.end();
    process.exit(1);
}

