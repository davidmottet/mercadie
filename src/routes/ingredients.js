import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient
} from '../controllers/ingredients.js';

const router = express.Router();

router.get('/', authMiddleware, getIngredients);
router.get('/:id', authMiddleware, getIngredientById);
router.post('/', authMiddleware, requireRole('admin'), createIngredient);
router.put('/:id', authMiddleware, requireRole('admin'), updateIngredient);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteIngredient);

export default router;