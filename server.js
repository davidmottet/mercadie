const app = require("./src/app");
const mongoose = require("mongoose");
const config = require("./config/default");

mongoose.connect(config.database.uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to the database");

    const PORT = config.app.port;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });
