#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Afficher l'aide si demandé
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [username] [email] [password]"
    echo "  username : Nom d'utilisateur de l'admin (défaut: admin)"
    echo "  email : Email de l'admin (défaut: admin@mercadie.com)"
    echo "  password : Mot de passe de l'admin (défaut: adminpassword)"
    exit 0
fi

echo -e "${GREEN}🚀 Création d'un utilisateur administrateur...${NC}"

# Exécuter le script Node.js
node create_admin.js "$1" "$2" "$3" 