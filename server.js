const app = require("./src/app");
const config = require("./config/default");

const PORT = config.app.port;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});