import MeasurementUnit from '../models/measurementUnit.js';

export const createMeasurementUnit = async (req, res) => {
  const measurementUnit = new MeasurementUnit(req.body);
  await measurementUnit.save();
  res.status(201).json(measurementUnit);
};

export const getMeasurementUnits = async (req, res) => {
  const measurementUnits = await MeasurementUnit.find({});
  res.json(measurementUnits);
};

export const getMeasurementUnitById = async (req, res) => {
  const measurementUnit = await MeasurementUnit.findById(req.params.id);
  
  if (!measurementUnit) {
    const error = new Error('Unité de mesure non trouvée');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(measurementUnit);
};

export const updateMeasurementUnit = async (req, res) => {
  const measurementUnit = await MeasurementUnit.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!measurementUnit) {
    const error = new Error('Unité de mesure non trouvée');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(measurementUnit);
};

export const deleteMeasurementUnit = async (req, res) => {
  const measurementUnit = await MeasurementUnit.findByIdAndDelete(req.params.id);
  
  if (!measurementUnit) {
    const error = new Error('Unité de mesure non trouvée');
    error.statusCode = 404;
    throw error;
  }
  
  res.json({ message: 'Unité de mesure supprimée avec succès' });
};