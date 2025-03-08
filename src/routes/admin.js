import express from 'express';
import { runScript, getProcessLogs, stopProcess } from '../controllers/adminController.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.post('/scripts/run', runScript);
router.get('/scripts/process/:processId/logs', getProcessLogs);
router.post('/scripts/process/:processId/stop', stopProcess);

export default router; 