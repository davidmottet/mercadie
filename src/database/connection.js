const mongoose = require("mongoose");
const config = require("../../config/default");

const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to the database");
  } catch (err) {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  }
};

module.exports = connectToDatabase;
