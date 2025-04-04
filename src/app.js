import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import config from '../config/default.js';
import connectToDatabase from './database/connection.js';
import ingredientRoutes from './routes/ingredients.js';
import measurementUnitRoutes from './routes/measurementUnit.js';
import recipes from './routes/recipes.js';
import auth from './routes/auth.js';
import generator from './routes/generator.js';
import views from './routes/views.js';
import admin from './routes/admin.js';
import './services/cron.js';
import { handle404, handleErrors } from './middlewares/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares de base
app.use(express.json());
app.use(session(config.session));

// Connexion à la base de données
connectToDatabase();

// Configuration des vues
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, './views'));
app.use(express.static(path.join(__dirname, './public')));

// Configuration des routes API
const apiBasePath = config.api.basePath;
const apiVersion = config.api.version;
const baseRoute = `${apiBasePath}/${apiVersion}`;

// Routes de l'API
app.use(`${baseRoute}/ingredients`, ingredientRoutes);
app.use(`${baseRoute}/measurement-units`, measurementUnitRoutes);
app.use(`${baseRoute}/recipes`, recipes);
app.use(`${baseRoute}/generator`, generator);
app.use(`${baseRoute}/auth`, auth);
app.use(`${baseRoute}/admin`, admin);

// Routes des vues (front-end)
app.use('/', views);

// Gestion des erreurs - TOUJOURS en dernier
app.use(handle404); // Capture les routes non trouvées
app.use(handleErrors); // Gère toutes les erreurs

export default app;