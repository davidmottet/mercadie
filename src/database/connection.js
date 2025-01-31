const mongoose = require("mongoose");
const config = require("../../config/default");
const logger = require("../utils/logger");

const connectToDatabase = async () => {
  logger.info("🔄 Tentative de connexion à la base de données...");
  
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info("✅ Connecté à la base de données");
  } catch (err) {
    logger.error("❌ Erreur de connexion à la base de données:", {
      error: err.message,
      stack: err.stack
    });
    setTimeout(connectToDatabase, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('🔄 Déconnecté de la base de données. Tentative de reconnexion...');
  connectToDatabase();
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ Erreur de connexion MongoDB:', {
    error: err.message,
    stack: err.stack
  });
});

module.exports = connectToDatabase;