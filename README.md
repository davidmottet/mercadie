# Projet Mercadie

## Prérequis

Avant de commencer, assurez-vous que les outils suivants sont installés sur votre machine :

- [Node.js](https://nodejs.org) (v14 ou supérieur recommandé)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/) (inclus avec Node.js)
- [Git](https://git-scm.com/)

## Installation

1. **Cloner le dépôt**

   Clonez le répertoire du projet à partir de GitHub :
   ```bash
   git clone https://github.com/davidmottet/mercadie.git
   cd mercadie
   ```

2. **Installer les dépendances**

   Utilisez npm ou yarn pour installer les dépendances :
   ```bash
   npm install
   # ou
   yarn install
   ```

3. **Configurer les variables d'environnement**

   Créez un fichier `.env` à la racine du projet et configurez les variables nécessaires. Voici un exemple de contenu :
   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URI=mongodb://localhost:27017/nom_de_la_base
   ```

4. **Démarrer l'application**

   Démarrez l'application en mode développement :
   ```bash
   npm run dev
   # ou
   yarn dev
   ```
   
   Pour le mode production, exécutez :
   ```bash
   npm start
   # ou
   yarn start
   ```

## Fonctionnement

### Démarrage du serveur

- Par défaut, le serveur écoute sur le port configuré dans la variable d'environnement `PORT` (par défaut : 3000).
- Vous pouvez accéder à l'API à l'adresse suivante :
  ```
  http://localhost:3000
  ```

### Structure du projet

Voici un résumé de la structure du projet :

```
/my-nodejs-project
├── /src
│   ├── /controllers      # Logique des routes
│   ├── /middlewares      # Middlewares personnalisés
│   ├── /routes           # Définitions des routes
│   ├── /models           # Modèles Mongoose
│   └── /database         # Gestion de la connexion à la base de données
├── /config               # Configuration de l'application
├── .gitignore            # Fichiers à ignorer par Git
├── app.js                # Configuration principale de l'application
├── server.js             # Point d'entrée pour démarrer le serveur
├── package.json          # Gestion des dépendances
└── README.md             # Documentation du projet
```

### Fonctionnalités principales

1. **API REST** :
   - Points de terminaison exposés sous `/api`
   - Exemple :
     ```bash
     GET /api/ressource
     POST /api/ressource
     ```

2. **Connexion à la base de données** :
   - La base de données MongoDB est configurée via `DATABASE_URI`.

3. **Logs** :
   - Les requêtes et erreurs sont enregistrées via [morgan](https://github.com/expressjs/morgan).

4. **Gestion des erreurs** :
   - Middleware personnalisé pour un retour uniforme des erreurs.

## Scripts disponibles

- **`npm run dev`** : Lance le serveur en mode développement avec redémarrage automatique via [nodemon](https://github.com/remy/nodemon).
- **`npm start`** : Lance le serveur en mode production.
- **`npm test`** : Exécute les tests (si configurés).

## Tests

Si des tests unitaires ou fonctionnels sont configurés, exécutez-les avec :
```bash
npm test
```

## Déploiement

1. **Build de production** (si applicable) :
   ```bash
   npm run build
   ```

2. **Lancer en production** :
   ```bash
   npm start
   ```

## Contribution

Si vous souhaitez contribuer :

1. Forkez le dépôt
2. Créez une branche de fonctionnalité :
   ```bash
   git checkout -b feature/ma-nouvelle-fonctionnalite
   ```
3. Faites vos modifications et ajoutez-les :
   ```bash
   git add .
   git commit -m "Ajout d'une nouvelle fonctionnalité"
   ```
4. Poussez la branche et créez une Pull Request :
   ```bash
   git push origin feature/ma-nouvelle-fonctionnalite
   ```

## Docker
   ```sh
   docker run -e PORT=4000 -p 4000:4000 mon-projet-nodejs
   ```

## Configuration MongoDB avec Docker

Pour configurer MongoDB avec Docker, suivez ces étapes :

1. **Lancer MongoDB avec Docker**
   ```bash
   docker run -d \
   --name mongodb \
   -p 27017:27017 \
   -e MONGO_INITDB_ROOT_USERNAME=admin \
   -e MONGO_INITDB_ROOT_PASSWORD=<votre_mot_de_passe> \
   -v mongodb_data:/data/db \
   --restart unless-stopped \
   mongo
   ```

2. **Configurer les variables d'environnement**

   Dans votre fichier `.env`, ajoutez :
   ```env
   DATABASE_URI=mongodb://admin:<votre_mot_de_passe>@localhost:27017/mercadie?authSource=admin
   ```

3. **Vérifier l'état de MongoDB**
   ```bash
   # Vérifier que le conteneur est en cours d'exécution
   docker ps | grep mongodb

   # Voir les logs du conteneur
   docker logs mongodb
   ```

4. **Commandes Docker utiles**
   ```bash
   # Arrêter MongoDB
   docker stop mongodb

   # Démarrer MongoDB
   docker start mongodb

   # Supprimer le conteneur
   docker rm mongodb

   # Voir les volumes
   docker volume ls
   ```

## Licence

Ce projet est sous licence [MIT](LICENSE).

