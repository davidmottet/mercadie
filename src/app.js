import express from 'express';
import config from '../config/default.js';
import ingredientRoutes from './routes/ingredients.js';
import connectToDatabase from './database/connection.js';

const app = express();

app.use(express.json());

connectToDatabase();

// Configuration des routes API
const apiBasePath = config.api.basePath;
const apiVersion = config.api.version;
const baseRoute = `${apiBasePath}/${apiVersion}`;

export default app;