#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paramètres par défaut
DEFAULT_USER="mongo"
DEFAULT_PASSWORD="mongopwd"

# Récupération des paramètres
MONGO_USER=${1:-$DEFAULT_USER}
MONGO_PASSWORD=${2:-$DEFAULT_PASSWORD}

# Afficher l'aide si demandé
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [username] [password]"
    echo "  username : Nom d'utilisateur MongoDB (défaut: $DEFAULT_USER)"
    echo "  password : Mot de passe MongoDB (défaut: $DEFAULT_PASSWORD)"
    exit 0
fi

echo -e "${GREEN}🚀 Début de la configuration de MongoDB...${NC}"
echo -e "${GREEN}👤 Utilisateur: $MONGO_USER${NC}"

# 1. Vérifier si MongoDB est installé
if ! command -v mongod &> /dev/null; then
    echo -e "${RED}❌ MongoDB n'est pas installé. Veuillez d'abord installer MongoDB.${NC}"
    exit 1
fi

# 2. Vérifier si le service MongoDB est en cours d'exécution
if ! systemctl is-active --quiet mongod; then
    echo -e "${GREEN}▶️ Démarrage du service MongoDB...${NC}"
    systemctl start mongod
    sleep 2
fi

# 3. Sauvegarder la configuration MongoDB existante
echo -e "${GREEN}📑 Sauvegarde de la configuration MongoDB...${NC}"
cp /etc/mongod.conf /etc/mongod.conf.backup

# 4. Activer l'authentification dans la configuration MongoDB
echo -e "${GREEN}🔐 Configuration de l'authentification MongoDB...${NC}"
if ! grep -q "^security:" /etc/mongod.conf; then
    echo -e "\nsecurity:\n  authorization: enabled" >> /etc/mongod.conf
fi

# 5. Redémarrer MongoDB pour appliquer les changements
echo -e "${GREEN}🔄 Redémarrage du service MongoDB...${NC}"
systemctl restart mongod
sleep 2

# 6. Créer l'utilisateur MongoDB
echo -e "${GREEN}👤 Création de l'utilisateur MongoDB...${NC}"
mongosh admin --eval "
db.createUser({
    user: \"$MONGO_USER\",
    pwd: \"$MONGO_PASSWORD\",
    roles: [
        { role: \"userAdminAnyDatabase\", db: \"admin\" },
        { role: \"readWriteAnyDatabase\", db: \"admin\" }
    ]
})" > /dev/null 2>&1

# 7. Tester la connexion
echo -e "${GREEN}🔍 Test de la connexion...${NC}"
CONNECTION_STRING="mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/mercadie?authSource=admin"
if mongosh "$CONNECTION_STRING" --eval "db.getName()" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Configuration MongoDB réussie !${NC}"
    echo -e "${GREEN}📝 URL de connexion : $CONNECTION_STRING${NC}"
else
    echo -e "${RED}❌ Erreur lors du test de connexion. Veuillez vérifier les paramètres.${NC}"
fi 