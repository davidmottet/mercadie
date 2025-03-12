import 'dotenv/config';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import config from './config/default.js';
import app from './src/app.js';
import logger from './src/utils/logger.js';
import { fullUrl } from './src/utils/isIpAddress.js';

if (config.app.useHttps === 'true') {
  try {
    const options = {
      key: fs.readFileSync(path.join(process.cwd(), 'ssl', 'private.key')),
      cert: fs.readFileSync(path.join(process.cwd(), 'ssl', 'certificate.crt'))
    };

    https.createServer(options, app).listen(config.app.port, () => {
      logger.info(`🔐 Serveur HTTPS démarré sur ${fullUrl}`);
    });
  } catch (error) {
    logger.error('Erreur lors du chargement des certificats SSL:', error);
    process.exit(1);
  }
} else {
  http.createServer(app).listen(config.app.port, () => {
    logger.info(`🚀 Serveur HTTP démarré sur ${fullUrl}`);
  });
}