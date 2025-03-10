FROM node:current-alpine

WORKDIR /app

# Installation des dépendances système nécessaires
RUN apk add --no-cache python3 make g++

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm ci --only=production

# Copie du reste des fichiers
COPY . .

# Configuration des permissions pour le script d'entrée
COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

# Création du dossier logs avec les bonnes permissions
RUN mkdir -p logs && chown -R node:node logs

# Utilisation de l'utilisateur non-root pour plus de sécurité
USER node

# Commande de démarrage
CMD ["/usr/src/app/entrypoint.sh"]
