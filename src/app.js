const express = require("express");
const mongoose = require("mongoose");
const config = require("../config/default");

const app = express();

mongoose.connect(config.database.uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to the database"))
  .catch(err => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });

app.use(express.json());

module.exports = app;
