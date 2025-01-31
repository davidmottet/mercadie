require('dotenv').config();
const app = require("./src/app");
const config = require("./config/default");
const logger = require("./src/utils/logger");

const PORT = config.app.port;
app.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});