const config = {
  app: {
    name: "mercadie",
    url: process.env.URL || "mercadie.com",
    port: process.env.PORT || 3000,
    useHttps: process.env.USE_HTTPS || false,
    sslKey: process.env.SSL_KEY || null,
    sslCert: process.env.SSL_CERT || null,
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
  session: {
    secret: process.env.SESSION_SECRET || 'votre_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production'
    }
  },
  api: {
    version: "v1",
    basePath: "/api",
  },
  ia: {
    openAi: {
      key: process.env.OPENAI_API_KEY || "defaultsecretkey"
    },
    ollama: {
      url: process.env.OLLAMA_URL || "ollama.com",
      port: process.env.OLLAMA_PORT || "11434",
      model: process.env.OLLAMA_MODEL || "llama3.2:1b"
    }
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

export default config;