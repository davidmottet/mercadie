
import config from '../../config/default.js';

const PORT = config.app.port;
const URL = config.app.url;

export const isIpAddress = (url) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(url);
};

export const fullUrl = isIpAddress(URL) ? `http://${URL}:${PORT}` : URL;
