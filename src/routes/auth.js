import express from 'express';
const router = express.Router();
import { authMiddleware } from '../middlewares/auth.js';
import { asyncApiHandler } from '../middlewares/asyncHandler.js';
import {
  signup,
  login,
  logout
} from '../controllers/auth.js';

router.post('/signup', asyncApiHandler(signup));
router.post('/login', asyncApiHandler(login));
router.post('/logout', authMiddleware, asyncApiHandler(logout));

export default router;