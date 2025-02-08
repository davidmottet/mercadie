import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import {
  createMeasurementUnit,
  getMeasurementUnits,
  getMeasurementUnitById,
  updateMeasurementUnit,
  deleteMeasurementUnit
} from '../controllers/measurementUnits.js';

const router = express.Router();

router.get('/', authMiddleware, getMeasurementUnits);
router.get('/:id', authMiddleware, getMeasurementUnitById);
router.post('/', authMiddleware, requireRole('admin'), createMeasurementUnit);
router.put('/:id', authMiddleware, requireRole('admin'), updateMeasurementUnit);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteMeasurementUnit);

export default router;