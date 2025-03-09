import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe
} from '../controllers/recipes.js';

const router = express.Router();

router.get('/', authMiddleware, asyncApiHandler(getRecipes));
router.get('/:id', authMiddleware, asyncApiHandler(getRecipeById));
router.post('/', authMiddleware, requireRole('admin'), asyncApiHandler(createRecipe));
router.put('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(updateRecipe));
router.delete('/:id', authMiddleware, requireRole('admin'), asyncApiHandler(deleteRecipe));

export default router;