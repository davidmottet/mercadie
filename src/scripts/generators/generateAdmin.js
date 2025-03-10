import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.js';
import bcrypt from 'bcryptjs';

// Charger les variables d'environnement
dotenv.config();

export async function generateAdminUser(username = 'admin', email = 'admin@mercadie.com', password = 'adminpassword') {
    try {
        // Connexion à MongoDB
        console.log('🔄 Connexion à la base de données...');
        await mongoose.connect(process.env.DATABASE_URI);
        console.log('✅ Connecté à MongoDB');

        // Vérifier si l'admin existe déjà
        const existingAdmin = await User.findOne({ 
            $or: [
                { username },
                { email }
            ]
        });

        if (existingAdmin) {
            throw new Error('Un administrateur avec ce nom d\'utilisateur ou email existe déjà');
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'administrateur
        const adminUser = new User({
            username,
            email,
            password: hashedPassword,
            roles: ['admin']
        });

        // Sauvegarder l'administrateur
        await adminUser.save();
        console.log('✅ Administrateur créé avec succès !');
        console.log('👤 Identifiants :');
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);

        return adminUser;
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        throw error;
    } finally {
        await mongoose.connection.close();
    }
}

// Si le script est exécuté directement
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const username = process.argv[2] || 'admin';
    const email = process.argv[3] || 'admin@mercadie.com';
    const password = process.argv[4] || 'adminpassword';

    generateAdminUser(username, email, password)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} 