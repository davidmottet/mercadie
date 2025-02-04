import express from 'express';
import authMiddleware from '../middlewares/auth.js';
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
router.post('/', authMiddleware, createIngredient);
router.put('/:id', authMiddleware, updateIngredient);
router.delete('/:id', authMiddleware, deleteIngredient);

export default router;