import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';
import {
  generateIngredients,
  generateIngredient
} from '../controllers/generator.js';

const router = express.Router();

router.post('/ingredients', asyncApiHandler(generateIngredients));
router.post('/ingredient', asyncApiHandler(generateIngredient));

export default router;