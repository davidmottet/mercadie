import Recipe from '../models/recipe.js';
import RecipeStep from '../models/recipeStep.js';

export const createRecipe = async (req, res) => {
  const stepsData = req.body.steps || [];
  const steps = await RecipeStep.insertMany(stepsData);

  const recipeData = {
    ...req.body,
    steps: steps.map(step => step._id)
  };
  const recipe = new Recipe(recipeData);
  await recipe.save();

  res.status(201).json(recipe);
};

export const getRecipes = async (req, res) => {
  const recipes = await Recipe.find()
    .populate('steps')
    .populate('ingredients');
  res.json(recipes);
};

export const getRecipeById = async (req, res) => {
  const recipe = await Recipe.findById(req.params.id)
    .populate('steps')
    .populate('ingredients');
  
  if (!recipe) {
    const error = new Error('Recette non trouvée');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(recipe);
};

export const updateRecipe = async (req, res) => {
  const { id } = req.params;
  const { steps: stepsData, ...recipeData } = req.body;

  // Mettre à jour ou créer les étapes
  const steps = await Promise.all(stepsData.map(async (step) => {
    if (step._id) {
      const updatedStep = await RecipeStep.findByIdAndUpdate(step._id, step, { new: true, runValidators: true });
      if (!updatedStep) {
        const error = new Error('Étape de recette non trouvée');
        error.statusCode = 404;
        throw error;
      }
      return updatedStep;
    } else {
      return await new RecipeStep(step).save();
    }
  }));

  // Mettre à jour la recette
  const recipe = await Recipe.findByIdAndUpdate(
    id,
    { ...recipeData, steps: steps.map(step => step._id) },
    { new: true, runValidators: true }
  ).populate('steps')
    .populate('ingredients');

  if (!recipe) {
    const error = new Error('Recette non trouvée');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(recipe);
};

export const deleteRecipe = async (req, res) => {
  const { id } = req.params;

  const recipe = await Recipe.findById(id);
  if (!recipe) {
    const error = new Error('Recette non trouvée');
    error.statusCode = 404;
    throw error;
  }

  // Supprimer les étapes associées
  await RecipeStep.deleteMany({ _id: { $in: recipe.steps } });
  await recipe.remove();

  res.json({ message: 'Recette et étapes associées supprimées avec succès' });
};