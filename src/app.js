import express from 'express';
import config from '../config/default.js';
import ingredientRoutes from './routes/ingredients.js';
import connectToDatabase from './database/connection.js';

const app = express();

app.use(express.json());

connectToDatabase();

const apiBasePath = config.api.basePath;
const apiVersion = config.api.version;
const baseRoute = `${apiBasePath}/${apiVersion}`;

app.use(`${baseRoute}/ingredients`, ingredientRoutes);

export default app;