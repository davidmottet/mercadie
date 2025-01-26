const mongoose = require("mongoose");
const config = require("../../config/default");

const connectToDatabase = async () => {
  console.log("🔄 Tentative de connexion à la base de données...");
  
  try {
    await mongoose.connect(config.database.uri);
    console.log("✅ Connecté à la base de données");
  } catch (err) {
    console.error("❌ Erreur de connexion à la base de données:", err);
    setTimeout(connectToDatabase, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('🔄 Déconnecté de la base de données. Tentative de reconnexion...');
  connectToDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion MongoDB:', err);
});

module.exports = connectToDatabase;