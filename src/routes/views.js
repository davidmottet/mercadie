import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', (req, res) => {
    const order = { length: 3 };
    const changeHeader = false;

    res.render('index', {
        user: {},
        order,
        changeHeader
    });
});

router.get('/signin', (req, res) => {
    const user = req.user || {};
    const order = req.order || { length: 0 };

    res.render('signin', { user, order });
});

export default router;