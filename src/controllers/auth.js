import config from '../../config/default.js';
import User from '../models/user.js';
import Session from '../models/session.js';
import { generateToken, parseDuration } from '../utils/jwt.js';

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
    const expiresAt = new Date(Date.now() + parseDuration(config.jwt.expiresIn));
    const session = new Session({
      user: user._id,
      token,
      expiresAt
    });
    await session.save();

    user.sessionCount += 1;
    await user.save();
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    req.session.user = userWithoutPassword;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Invalider le token dans la base de données
    await Session.updateOne({ token }, { isValid: false });

    // Détruire la session
    req.session = null;
    res.clearCookie('connect.sid');
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};