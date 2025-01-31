module.exports = {
    app: {
      name: "mercadie",
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || "development",
    },
    database: {
      uri: process.env.DATABASE_URI || "mongodb://localhost:27017/nom_de_la_base",
      options: {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10
      }
    },
    jwt: {
      secret: process.env.JWT_SECRET || "defaultsecretkey",
      expiresIn: "1h",
    },
    api: {
      version: "v1",
      basePath: "/api",
    },
    log: {
      level: process.env.LOG_LEVEL || "info",
      format: process.env.LOG_FORMAT || "combined",
      directory: process.env.LOG_DIR || "logs",
      filename: {
        error: "error.log",
        combined: "combined.log"
      }
    },
    mail: {
      smtpHost: process.env.SMTP_HOST || "smtp.example.com",
      smtpPort: process.env.SMTP_PORT || 587,
      user: process.env.SMTP_USER || "example@example.com",
      password: process.env.SMTP_PASSWORD || "password",
    },
    cache: {
      redisUrl: process.env.REDIS_URL || "redis://votre-url-redis",
    },
  };
  