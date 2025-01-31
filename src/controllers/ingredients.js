import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

export const createIngredient = async (req, res) => {
    try {
        const ingredient = new Ingredient(req.body);
        await ingredient.save();
        res.status(201).json(ingredient);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getIngredients = async (req, res) => {
    try {
        const ingredients = await Ingredient.find()
            .populate('measurementUnit');
        res.json(ingredients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getIngredientById = async (req, res) => {
    try {
        const ingredient = await Ingredient.findById(req.params.id)
            .populate('measurementUnit');
        if (!ingredient) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        res.json(ingredient);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateIngredient = async (req, res) => {
    try {
        const ingredient = await Ingredient.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('measurementUnit');
        
        if (!ingredient) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        res.json(ingredient);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteIngredient = async (req, res) => {
    try {
        const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
        if (!ingredient) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        res.json({ message: 'Ingredient deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};