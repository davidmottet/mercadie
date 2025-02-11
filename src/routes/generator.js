import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import {
    generateIngredients,
    generateIngredient
} from '../controllers/generator.js';

const router = express.Router();

router.post('/ingredients', generateIngredients);
router.post('/ingredient', generateIngredient);

export default router;