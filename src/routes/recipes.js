import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe
} from '../controllers/recipes.js';

const router = express.Router();

router.get('/', authMiddleware, getRecipes);
router.get('/:id', authMiddleware, getRecipeById);
router.post('/', authMiddleware, requireRole('admin'), createRecipe);
router.put('/:id', authMiddleware, requireRole('admin'), updateRecipe);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteRecipe);

export default router;