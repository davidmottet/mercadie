import express from 'express';
const router = express.Router();
import { authMiddleware } from '../middlewares/auth.js';
import {
  signup,
  login,
  logout
} from '../controllers/auth.js';

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);

export default router;