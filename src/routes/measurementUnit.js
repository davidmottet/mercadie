import express from 'express';
import {
  createMeasurementUnit,
  getMeasurementUnits,
  getMeasurementUnitById,
  updateMeasurementUnit,
  deleteMeasurementUnit
} from '../controllers/measurementUnits.js';

const router = express.Router();

router.post('/', createMeasurementUnit);
router.get('/', getMeasurementUnits);
router.get('/:id', getMeasurementUnitById);
router.put('/:id', updateMeasurementUnit);
router.delete('/:id', deleteMeasurementUnit);

export default router;