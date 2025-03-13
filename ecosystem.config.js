export default {
  apps: [{
    name: "mercadie",
    script: "server.js",
    interpreter: "node",
    interpreter_args: "-r dotenv/config",
    env: {
      NODE_ENV: "production",
      PORT: 80
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G"
  }]
} 