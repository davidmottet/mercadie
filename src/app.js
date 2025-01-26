const express = require("express");
const mongoose = require("mongoose");
const config = require("../config/default");
const cacheManager = require('./utils/cacheManager');

const app = express();

mongoose.connect(config.database.uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to the database"))
  .catch(err => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });

app.use(express.json());

/*
  app.get(`${config.api.basePath}/${config.api.version}/data`, async (req, res, next) => {
    try {
      // Créer une clé de cache qui inclut la version de l'API
      const cacheKey = `${config.api.basePath}/${config.api.version}/data`;
      
      // Vérifier le cache
      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // Si pas en cache, récupérer les données
      const data = await votreModele.find();
      
      // Mettre en cache
      const ttl = parseInt(config.jwt.expiresIn) || 3600;
      await cacheManager.set(cacheKey, JSON.stringify(data), ttl);
      
      res.json(data);
    } catch (error) {
      // Utiliser le middleware d'erreur centralisé
      next(error);
    }
  });
*/

module.exports = app;
