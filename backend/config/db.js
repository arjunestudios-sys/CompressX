const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'compressx.json');

let store = {
    users: [],
    files: [],
    compression_history: [],
    transformations: []
};

if (fs.existsSync(dbPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        store = {
            users: loaded.users || [],
            files: loaded.files || [],
            compression_history: loaded.compression_history || [],
            transformations: loaded.transformations || []
        };
    } catch(e) {}
}

let saveTimeout = null;
function saveStore() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        fs.writeFile(dbPath, JSON.stringify(store, null, 2), 'utf8', () => {});
    }, 50);
}

process.on('beforeExit', () => {
    try { fs.writeFileSync(dbPath, JSON.stringify(store, null, 2)); } catch(e) {}
});

class PreparedStmt {
    constructor(sql) {
        this.sql = sql;
    }

    run(...args) {
        if (this.sql.includes('INSERT INTO users')) {
            const [name, email, password_hash, google_id, profile_image] = args;
            const newUser = {
                id: store.users.length ? Math.max(...store.users.map(u => u.id)) + 1 : 1,
                name: name || args[0],
                email: email || args[1],
                password_hash: password_hash || args[2] || null,
                google_id: google_id || args[3] || null,
                profile_image: profile_image || args[4] || null,
                storage_used: 0,
                notification_prefs: '{"emailUpload": true, "emailCompress": true}',
                created_at: new Date().toISOString()
            };
            store.users.push(newUser);
            saveStore();
            return { lastInsertRowid: newUser.id };
        } else if (this.sql.includes('INSERT INTO files')) {
            const [user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path] = args;
            const newFile = {
                id: store.files.length ? Math.max(...store.files.map(f => f.id)) + 1 : 1,
                user_id,
                original_name,
                stored_name,
                file_type,
                mime_type,
                file_size,
                storage_path,
                status: 'active',
                created_at: new Date().toISOString()
            };
            store.files.push(newFile);
            saveStore();
            return { lastInsertRowid: newFile.id };
        } else if (this.sql.includes('INSERT INTO compression_history')) {
            const [user_id, original_file, compressed_file, original_size, compressed_size, compression_percentage, compression_format] = args;
            const record = {
                id: store.compression_history.length ? Math.max(...store.compression_history.map(r => r.id)) + 1 : 1,
                user_id,
                original_file,
                compressed_file,
                original_size,
                compressed_size,
                compression_percentage,
                compression_format,
                created_at: new Date().toISOString()
            };
            store.compression_history.push(record);
            saveStore();
            return { lastInsertRowid: record.id };
        } else if (this.sql.includes('INSERT INTO transformations')) {
            const [user_id, original_name, result_name, action_type, original_size, result_size, percentage_saved, download_url] = args;
            const record = {
                id: store.transformations.length ? Math.max(...store.transformations.map(r => r.id)) + 1 : 1,
                user_id,
                original_name,
                result_name,
                action_type,
                original_size,
                result_size,
                percentage_saved: percentage_saved || 0,
                download_url,
                created_at: new Date().toISOString()
            };
            store.transformations.push(record);
            saveStore();
            return { lastInsertRowid: record.id };
        } else if (this.sql.includes('UPDATE users SET storage_used = storage_used +')) {
            const [size, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.storage_used = (user.storage_used || 0) + size; saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE users SET storage_used = MAX(0, storage_used -')) {
            const [size, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.storage_used = Math.max(0, (user.storage_used || 0) - size); saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE users SET password_hash =')) {
            const [hash, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.password_hash = hash; saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE users SET name =')) {
            const [name, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.name = name; saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE users SET notification_prefs =')) {
            const [prefs, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.notification_prefs = typeof prefs === 'string' ? prefs : JSON.stringify(prefs); saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE users SET google_id =')) {
            const [gid, img, userId] = args;
            const user = store.users.find(u => String(u.id) === String(userId));
            if (user) { user.google_id = gid; if (img) user.profile_image = img; saveStore(); }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE files SET original_name =')) {
            const [origName, storedName, storagePath, fileId] = args;
            const file = store.files.find(f => String(f.id) === String(fileId));
            if (file) {
                file.original_name = origName;
                file.stored_name = storedName;
                file.storage_path = storagePath;
                saveStore();
            }
            return { changes: 1 };
        } else if (this.sql.includes('UPDATE files SET file_size =')) {
            const [size, fileId] = args;
            const file = store.files.find(f => String(f.id) === String(fileId));
            if (file) {
                file.file_size = size;
                saveStore();
            }
            return { changes: 1 };
        } else if (this.sql.includes('DELETE FROM files WHERE id =')) {
            const [fileId] = args;
            store.files = store.files.filter(f => String(f.id) !== String(fileId));
            saveStore();
            return { changes: 1 };
        } else if (this.sql.includes('DELETE FROM transformations WHERE id =')) {
            const [id, userId] = args;
            store.transformations = store.transformations.filter(t => !(String(t.id) === String(id) && (userId ? String(t.user_id) === String(userId) : true)));
            saveStore();
            return { changes: 1 };
        } else if (this.sql.includes('DELETE FROM transformations WHERE user_id =')) {
            const [userId] = args;
            const beforeCount = store.transformations.length;
            store.transformations = store.transformations.filter(t => String(t.user_id) !== String(userId));
            saveStore();
            return { changes: beforeCount - store.transformations.length };
        } else if (this.sql.includes('DELETE FROM compression_history WHERE user_id =')) {
            const [userId] = args;
            const beforeCount = store.compression_history.length;
            store.compression_history = store.compression_history.filter(c => String(c.user_id) !== String(userId));
            saveStore();
            return { changes: beforeCount - store.compression_history.length };
        }
        return { changes: 0, lastInsertRowid: 0 };
    }

    get(...args) {
        let result = null;
        if (this.sql.includes('SELECT * FROM users WHERE google_id = ? OR email = ?')) {
            const [gid, email] = args;
            const targetEmail = (email || '').toLowerCase().trim();
            result = store.users.find(u => (gid && u.google_id === gid) || (u.email && u.email.toLowerCase().trim() === targetEmail)) || null;
        } else if (this.sql.includes('SELECT * FROM users WHERE email = ?')) {
            const [email] = args;
            const targetEmail = (email || '').toLowerCase().trim();
            result = store.users.find(u => u.email && u.email.toLowerCase().trim() === targetEmail) || null;
        } else if (this.sql.includes('SELECT id FROM users WHERE email = ?')) {
            const [email] = args;
            const targetEmail = (email || '').toLowerCase().trim();
            result = store.users.find(u => u.email && u.email.toLowerCase().trim() === targetEmail) || null;
        } else if (this.sql.includes('SELECT id, name, email, google_id, profile_image, storage_used, notification_prefs, created_at FROM users WHERE id = ?')) {
            const [id] = args;
            result = store.users.find(u => String(u.id) === String(id)) || null;
        } else if (this.sql.includes('SELECT id, name, email, profile_image, storage_used, created_at FROM users WHERE id = ?')) {
            const [id] = args;
            result = store.users.find(u => String(u.id) === String(id)) || null;
        } else if (this.sql.includes('SELECT * FROM users WHERE id = ?')) {
            const [id] = args;
            result = store.users.find(u => String(u.id) === String(id)) || null;
        } else if (this.sql.includes('SELECT * FROM files WHERE id = ?') || this.sql.includes('SELECT id FROM files WHERE id = ?')) {
            const [id, userId] = args;
            result = store.files.find(f => String(f.id) === String(id) && (userId ? String(f.user_id) === String(userId) : true)) || null;
        } else if (this.sql.includes('SELECT id FROM files WHERE user_id = ? AND original_name = ? AND id != ?')) {
            const [userId, origName, id] = args;
            result = store.files.find(f => String(f.user_id) === String(userId) && f.original_name === origName && String(f.id) !== String(id) && f.status === 'active') || null;
        } else if (this.sql.includes('SELECT * FROM transformations WHERE id = ?')) {
            const [id, userId] = args;
            result = store.transformations.find(t => String(t.id) === String(id) && (userId ? String(t.user_id) === String(userId) : true)) || null;
        }
        return result ? { ...result } : null;
    }

    all(...args) {
        if (this.sql.includes('SELECT * FROM files WHERE user_id = ?')) {
            const userId = args[0];
            let list = store.files.filter(f => String(f.user_id) === String(userId) && f.status === 'active');
            
            if (this.sql.includes('AND file_type = ?')) {
                const category = args[1];
                list = list.filter(f => f.file_type === category);
            }
            if (this.sql.includes('AND original_name LIKE ?')) {
                const searchArg = args[args.length - 1] || '';
                const q = searchArg.replace(/%/g, '').toLowerCase();
                if (q) list = list.filter(f => f.original_name.toLowerCase().includes(q));
            }

            if (this.sql.includes('ORDER BY original_name ASC')) {
                list.sort((a, b) => a.original_name.localeCompare(b.original_name));
            } else if (this.sql.includes('ORDER BY file_size DESC')) {
                list.sort((a, b) => b.file_size - a.file_size);
            } else if (this.sql.includes('ORDER BY file_type ASC')) {
                list.sort((a, b) => a.file_type.localeCompare(b.file_type));
            } else {
                list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
            return list;
        } else if (this.sql.includes('SELECT * FROM files WHERE id IN')) {
            const userId = args[args.length - 1];
            const ids = args.slice(0, args.length - 1).map(String);
            return store.files.filter(f => ids.includes(String(f.id)) && String(f.user_id) === String(userId) && f.status === 'active');
        } else if (this.sql.includes('SELECT * FROM transformations WHERE user_id = ?')) {
            const userId = args[0];
            const list = store.transformations.filter(t => String(t.user_id) === String(userId));
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return list;
        } else if (this.sql.includes('SELECT * FROM compression_history WHERE user_id = ?')) {
            const userId = args[0];
            const list = store.compression_history.filter(c => String(c.user_id) === String(userId));
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return list;
        }
        return store.files;
    }
}

const db = {
    pragma: () => {},
    exec: () => {},
    prepare: (sql) => new PreparedStmt(sql)
};

console.log('⚡ Docholder Pure-JS SQLite Data Engine connected:', dbPath);
module.exports = db;
