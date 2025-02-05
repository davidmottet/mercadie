import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isValid: {
    type: Boolean,
    default: true
  }
});

const Session = mongoose.model('Session', sessionSchema);

export default Session;