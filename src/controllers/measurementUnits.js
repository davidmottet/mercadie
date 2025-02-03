import MeasurementUnit from '../models/measurementUnit.js';

export const createMeasurementUnit = async (req, res) => {
    try {
        const measurementUnit = new MeasurementUnit(req.body);
        await measurementUnit.save();
        res.status(201).send(measurementUnit);
    } catch (error) {
        res.status(400).send(error);
    }
};

export const getMeasurementUnits = async (req, res) => {
    try {
        const measurementUnits = await MeasurementUnit.find({});
        res.status(200).send(measurementUnits);
    } catch (error) {
        res.status(500).send(error);
    }
};

export const getMeasurementUnitById = async (req, res) => {
    try {
        const measurementUnit = await MeasurementUnit.findById(req.params.id);
        if (!measurementUnit) {
            return res.status(404).send();
        }
        res.status(200).send(measurementUnit);
    } catch (error) {
        res.status(500).send(error);
    }
};

export const updateMeasurementUnit = async (req, res) => {
    try {
        const measurementUnit = await MeasurementUnit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!measurementUnit) {
            return res.status(404).send();
        }
        res.status(200).send(measurementUnit);
    } catch (error) {
        res.status(400).send(error);
    }
};

export const deleteMeasurementUnit = async (req, res) => {
    try {
        const measurementUnit = await MeasurementUnit.findByIdAndDelete(req.params.id);
        if (!measurementUnit) {
            return res.status(404).send();
        }
        res.status(200).send(measurementUnit);
    } catch (error) {
        res.status(500).send(error);
    }
};