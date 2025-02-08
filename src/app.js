import express from 'express';
import config from '../config/default.js';
import connectToDatabase from './database/connection.js';
import { handle404, handleErrors } from './middlewares/errorHandler.js';
import ingredientRoutes from './routes/ingredients.js';
import measurementUnitRoutes from './routes/measurementUnit.js';
import recipes from './routes/recipes.js'
import auth from './routes/auth.js'

const app = express();

app.use(express.json());
app.use(handle404);
app.use(handleErrors);

connectToDatabase();

const apiBasePath = config.api.basePath;
const apiVersion = config.api.version;
const baseRoute = `${apiBasePath}/${apiVersion}`;

app.use(`${baseRoute}/ingredients`, ingredientRoutes);
app.use(`${baseRoute}/measurement-units`, measurementUnitRoutes);
app.use(`${baseRoute}/recipes`, recipes);
app.use(`${baseRoute}/auth`, auth);

export default app;