import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';
import {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient
} from '../controllers/ingredients.js';

const router = express.Router();

router.get('/', authMiddleware, asyncApiHandler(getIngredients));
router.get('/:id', authMiddleware, asyncApiHandler(getIngredientById));
router.post('/', authMiddleware, requireRole('admin'), asyncApiHandler(createIngredient));
router.put('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(updateIngredient));
router.delete('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(deleteIngredient));

export default router;