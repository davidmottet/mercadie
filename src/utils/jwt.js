import jwt from 'jsonwebtoken';
import config from '../../config/default.js';

export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export const parseDuration = (duration) => {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
  case 's': return value * 1000;
  case 'm': return value * 60 * 1000;
  case 'h': return value * 60 * 60 * 1000;
  case 'd': return value * 24 * 60 * 60 * 1000;
  default: return 0;
  }
}