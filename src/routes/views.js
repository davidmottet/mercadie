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
    const inputs = [
        { id: 1, type: "email", placeholder: "Email", value: `${user?.email ? user?.email : ''}`, name: 'email' },
        { id: 2, type: "password", placeholder: "Password", value: `${user?.password ? user?.password : ''}`, name: 'password' },
    ]

    res.render('signin', { user, order, inputs });
});

router.get('/signup', (req, res) => {
    const user = req.user || {};
    const order = req.order || { length: 0 };
    const inputs = [
        { id: 1, type: "text", placeholder: "Name", value: `${user?.name ? user?.name : ''}`, name: 'name' },
        { id: 2, type: "email", placeholder: "Email", value: `${user?.email ? user?.email : ''}`, name: 'email' },
        { id: 3, type: "text", placeholder: "Profile Picture Link", value: `${user?.image ? user?.image : ''}`, name: 'image' },
        { id: 4, type: "password", placeholder: "Password", value: `${user?.password ? user?.password : ''}`, name: 'password' },
    ]

    res.render('signup', { user, order, inputs });
});

export default router;