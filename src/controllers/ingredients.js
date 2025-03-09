import Ingredient from '../models/ingredient.js';

export const createIngredient = async (req, res) => {
  const ingredient = new Ingredient(req.body);
  await ingredient.save();
  res.status(201).json(ingredient);
};

export const getIngredients = async (req, res) => {
  const ingredients = await Ingredient.find()
    .populate('measurementUnit');
  res.json(ingredients);
};

export const getIngredientById = async (req, res) => {
  const ingredient = await Ingredient.findById(req.params.id)
    .populate('measurementUnit');
  
  if (!ingredient) {
    const error = new Error('Ingrédient non trouvé');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(ingredient);
};

export const updateIngredient = async (req, res) => {
  const ingredient = await Ingredient.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('measurementUnit');

  if (!ingredient) {
    const error = new Error('Ingrédient non trouvé');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(ingredient);
};

export const deleteIngredient = async (req, res) => {
  const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
  
  if (!ingredient) {
    const error = new Error('Ingrédient non trouvé');
    error.statusCode = 404;
    throw error;
  }
  
  res.json({ message: 'Ingrédient supprimé avec succès' });
};

export const renderIngredientsPage = async (req, res) => {
  const ingredients = await Ingredient.find().populate('measurementUnit');
  res.render('ingredients', { ingredients });
};