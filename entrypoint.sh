#!/bin/sh

# Utilise le port par défaut 3000 si $PORT n'est pas défini
PORT=${PORT:-3000}

echo "Starting application on port $PORT..."
npm start -- --port=$PORT
