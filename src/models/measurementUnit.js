import mongoose from 'mongoose';

const measurementUnitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
}, {
  timestamps: true
});

const MeasurementUnit = mongoose.model('MeasurementUnit', measurementUnitSchema);

export default MeasurementUnit;