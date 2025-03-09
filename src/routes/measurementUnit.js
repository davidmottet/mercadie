import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';
import {
  createMeasurementUnit,
  getMeasurementUnits,
  getMeasurementUnitById,
  updateMeasurementUnit,
  deleteMeasurementUnit
} from '../controllers/measurementUnits.js';

const router = express.Router();

router.get('/', authMiddleware, asyncApiHandler(getMeasurementUnits));
router.get('/:id', authMiddleware, asyncApiHandler(getMeasurementUnitById));
router.post('/', authMiddleware, requireRole('admin'), asyncApiHandler(createMeasurementUnit));
router.put('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(updateMeasurementUnit));
router.delete('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(deleteMeasurementUnit));

export default router;