import jwt from 'jsonwebtoken';
import config from '../../config/default.js';

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, config.jwt.secret);
};

export { generateToken, verifyToken };