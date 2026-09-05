const fs = require('fs');
const dbPath = './backend/database/compressx.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let updated = 0;
for (const file of db.files) {
    if (file.storage_path.includes('C:\\Users\\karnan\\Downloads\\arav (1)\\compressx')) {
        file.storage_path = file.storage_path.replace('C:\\Users\\karnan\\Downloads\\arav (1)\\compressx', 'C:\\mad\\ttt\\arav\\compressx');
        updated++;
    }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Updated ' + updated + ' records in JSON directly.');
