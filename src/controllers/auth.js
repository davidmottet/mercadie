import User from '../models/user.js';
import { generateToken } from '../utils/jwt.js';

export const signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Utilisateur existe déjà' });
        }

        const user = new User({ username, email, password });
        await user.save();

        const token = generateToken(user);
        res.status(201).json({ user, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const token = generateToken(user);
        res.json({ user, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};