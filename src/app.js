const express = require("express");
const connectToDatabase = require('./database/connection');

const app = express();

app.use(express.json());

connectToDatabase();

// ... le reste de votre code app.js ...

module.exports = app;