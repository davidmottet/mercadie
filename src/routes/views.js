import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import Ingredient from '../models/ingredient.js';
import { showAdminDashboard } from '../controllers/adminController.js';

const router = express.Router();

// Wrapper pour gérer les erreurs des vues
const asyncViewHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        // Si l'erreur n'a pas de code HTTP, on met 500 par défaut
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        // On ajoute les données de base pour le rendu des vues
        error.user = req.session?.user || {};
        error.order = req.order || { length: 0 };
        next(error);
    }
};

router.get('/', asyncViewHandler(async (req, res) => {
    const user = req.session.user || {};
    const order = { length: 3 };
    const changeHeader = false;

    res.render('landing', {
        user,
        order,
        changeHeader
    });
}));

router.get('/signin', asyncViewHandler(async (req, res) => {
    const user = req.session.user || {};
    const order = req.order || { length: 0 };
    const inputs = [
        { id: 1, type: "email", placeholder: "Email", value: `${user?.email ? user?.email : ''}`, name: 'email' },
        { id: 2, type: "password", placeholder: "Password", value: `${user?.password ? user?.password : ''}`, name: 'password' },
    ]

    res.render('signin', { user, order, inputs });
}));

router.get('/signup', asyncViewHandler(async (req, res) => {
    const user = req.session.user || {};
    const order = req.order || { length: 0 };
    const inputs = [
        { id: 1, type: "text", placeholder: "Name", value: `${user?.name ? user?.name : ''}`, name: 'name' },
        { id: 2, type: "email", placeholder: "Email", value: `${user?.email ? user?.email : ''}`, name: 'email' },
        { id: 3, type: "text", placeholder: "Profile Picture Link", value: `${user?.image ? user?.image : ''}`, name: 'image' },
        { id: 4, type: "password", placeholder: "Password", value: `${user?.password ? user?.password : ''}`, name: 'password' },
    ]

    res.render('signup', { user, order, inputs });
}));

router.get('/ingredients', asyncViewHandler(async (req, res) => {
    const user = req.session.user || {};
    const order = req.order || { length: 0 };
    
    const ingredients = await Ingredient.find().populate('measurementUnit');
    if (!ingredients) {
        const error = new Error('Impossible de récupérer les ingrédients');
        error.statusCode = 500;
        throw error;
    }
    
    res.render('ingredients', { user, order, ingredients });
}));

router.get('/admin', authMiddleware, requireRole('admin'), asyncViewHandler(showAdminDashboard));

export default router;