import 'dotenv/config';
import app from './src/app.js';
import config from './config/default.js';
import logger from './src/utils/logger.js';

const PORT = config.app.port;
app.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});