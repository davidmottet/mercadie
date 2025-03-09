import express from 'express';
import { runScript, getProcessLogs, stopProcess, showAdminDashboard } from '../controllers/adminController.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';

const router = express.Router();

router.get('/', authMiddleware, requireRole('admin'), asyncApiHandler(showAdminDashboard));
router.post('/scripts/run', asyncApiHandler(runScript));
router.get('/scripts/process/:processId/logs', asyncApiHandler(getProcessLogs));
router.post('/scripts/process/:processId/stop', asyncApiHandler(stopProcess));

export default router; 