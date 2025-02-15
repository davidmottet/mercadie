import 'dotenv/config';
import config from './config/default.js';
import app from './src/app.js';
import logger from './src/utils/logger.js';
import { fullUrl } from './src/utils/isIpAddress.js';

app.listen(config.app.port, () => {
  logger.info(`🚀 Serveur démarré sur ${fullUrl}`);
});