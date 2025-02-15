import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/default.js';
import connectToDatabase from './database/connection.js';
import ingredientRoutes from './routes/ingredients.js';
import measurementUnitRoutes from './routes/measurementUnit.js';
import recipes from './routes/recipes.js';
import auth from './routes/auth.js';
import generator from './routes/generator.js';
import './services/cron.js';
import { renderIngredientsPage } from './controllers/ingredients.js';
import { handle404, handleErrors } from './middlewares/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

connectToDatabase();

const apiBasePath = config.api.basePath;
const apiVersion = config.api.version;
const baseRoute = `${apiBasePath}/${apiVersion}`;

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, './views'));
app.use(express.static(path.join(__dirname, './public')));
app.use(`${baseRoute}/ingredients`, ingredientRoutes);
app.use(`${baseRoute}/measurement-units`, measurementUnitRoutes);
app.use(`${baseRoute}/recipes`, recipes);
app.use(`${baseRoute}/generator`, generator);
app.use(`${baseRoute}/auth`, auth);

app.get('/', (req, res) => {
    res.render('index', { title: 'Hey', message: 'Hello there!' })
})

app.get('/ingredients', renderIngredientsPage);

app.use(handle404);
app.use(handleErrors);

export default app;