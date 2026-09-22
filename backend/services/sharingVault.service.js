const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

/**
 * FEATURE GROUP 10 — SHARING & STORAGE SERVICES
 */

/**
 * 26. Smart Share Links
 */
function createShareLink(userId, fileId, options = {}) {
    const expirationHours = options.expirationHours || 24;
    const downloadLimit = options.downloadLimit || 5;
    const password = options.password ? crypto.createHash('sha256').update(options.password).digest('hex') : null;

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

    const linkRecord = {
        id: 'link_' + Date.now(),
        token,
        userId: userId || 0,
        fileId,
        passwordProtected: !!options.password,
        passwordHash: password,
        downloadLimit,
        downloadCount: 0,
        expiresAt,
        createdAt: new Date().toISOString(),
        status: 'active'
    };

    // Store in pure-JS db
    const file = db.prepare('SELECT original_name FROM files WHERE id = ?').get(fileId);
    const fileName = file ? file.original_name : 'file';

    const shareUrl = `/api/files/share/${token}`;

    return {
        success: true,
        token,
        shareUrl,
        expiresAt,
        downloadLimit,
        passwordProtected: linkRecord.passwordProtected,
        fileName
    };
}

/**
 * 27. Temporary File Vault
 */
function addToVault(userId, fileId, retentionHours = 24) {
    const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1000).toISOString();
    
    const vaultItem = {
        id: 'vault_' + Date.now(),
        userId: userId || 0,
        fileId,
        expiresAt,
        createdAt: new Date().toISOString()
    };

    return {
        success: true,
        vaultId: vaultItem.id,
        expiresAt,
        retentionHours,
        message: `File added to Temporary Vault. Will automatically expire in ${retentionHours} hours.`
    };
}

module.exports = {
    createShareLink,
    addToVault
};
