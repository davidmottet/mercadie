import { verifyToken } from '../utils/jwt.js';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Authentification requise' });
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

export default authMiddleware;