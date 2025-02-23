import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/user.js';

// Charger les variables d'environnement
dotenv.config();

// Paramètres par défaut pour l'administrateur
const defaultAdmin = {
    username: process.argv[2] || 'admin',
    email: process.argv[3] || 'admin@mercadie.com',
    password: process.argv[4] || 'adminpassword'
};

async function createAdminUser() {
    try {
        // Connexion à MongoDB
        console.log('🔄 Connexion à la base de données...');
        await mongoose.connect(process.env.DATABASE_URI);
        console.log('✅ Connecté à MongoDB');

        // Vérifier si l'admin existe déjà
        const existingAdmin = await User.findOne({ 
            $or: [
                { username: defaultAdmin.username },
                { email: defaultAdmin.email }
            ]
        });

        if (existingAdmin) {
            console.log('⚠️ Un administrateur avec ce nom d\'utilisateur ou email existe déjà');
            process.exit(1);
        }

        // Créer l'administrateur
        const adminUser = new User({
            username: defaultAdmin.username,
            email: defaultAdmin.email,
            password: defaultAdmin.password,
            roles: [] // Les rôles seront ajoutés une fois qu'ils seront définis
        });

        // Sauvegarder l'administrateur
        await adminUser.save();
        console.log('✅ Administrateur créé avec succès !');
        console.log('👤 Identifiants :');
        console.log(`   Username: ${defaultAdmin.username}`);
        console.log(`   Email: ${defaultAdmin.email}`);
        console.log(`   Password: ${defaultAdmin.password}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        // Fermer la connexion
        await mongoose.connection.close();
        process.exit(0);
    }
}

// Exécuter le script
createAdminUser(); 