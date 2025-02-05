import { verifyToken } from '../utils/jwt.js';
import Session from '../models/session.js';
import User from '../models/user.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) throw new Error('Token manquant');

    const decoded = verifyToken(token);
    const session = await Session.findOne({
      token,
      user: decoded.id,
      isValid: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) throw new Error('Session invalide');

    req.user = decoded;
    req.session = session;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Accès non autorisé : ' + error.message });
  }
};

export const requireRole = (roleName) => {
  return async (req, res, next) => {
    const user = await User.findById(req.user.id).populate('roles');
    const hasRole = user.roles.some(role => role.name === roleName);

    if (!hasRole) {
      return res.status(403).json({ message: 'Permission refusée' });
    }
    next();
  };
};