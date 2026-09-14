import { Router } from 'express';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { uploadsDir } from '../storage.js';

const router = Router();

/**
 * File Upload Subsystem
 * Routes mounted at /api/upload and /api/uploads
 */

// Static Serving for uploaded media
router.use('/uploads', express.static(uploadsDir));

// POST /api/upload
router.post(['/upload', '/'], async (req, res) => {
  try {
    const { base64Data, fileName, _mimeType, category, _poNumber, folderPath, description } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const fileId = `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = (fileName || `${fileId}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, storedFileName);

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/uploads/${storedFileName}`;
    res.json({
      success: true,
      fileId,
      fileUrl,
      fileName: fileName || safeName,
      folderPath: folderPath || category || '',
      description: description || '',
      size: buffer.length
    });
  } catch (err) {
    console.error('[server] File upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

export default router;
