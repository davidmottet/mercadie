import Recipe from '../models/recipe.js';
import RecipeStep from '../models/recipeStep.js';

export const createRecipe = async (req, res) => {
    try {
        const stepsData = req.body.steps || [];
        const steps = await RecipeStep.insertMany(stepsData);

        const recipeData = {
            ...req.body,
            steps: steps.map(step => step._id)
        };
        const recipe = new Recipe(recipeData);
        await recipe.save();

        res.status(201).json(recipe);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find()
            .populate('steps')
            .populate('ingredients');
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRecipeById = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id)
            .populate('steps')
            .populate('ingredients');
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const { steps: stepsData, ...recipeData } = req.body;

        const steps = await Promise.all(stepsData.map(async (step) => {
            if (step._id) {
                return await RecipeStep.findByIdAndUpdate(step._id, step, { new: true, runValidators: true });
            } else {
                return await new RecipeStep(step).save();
            }
        }));

        const recipe = await Recipe.findByIdAndUpdate(
            id,
            { ...recipeData, steps: steps.map(step => step._id) },
            { new: true, runValidators: true }
        ).populate('steps')
         .populate('ingredients');

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteRecipe = async (req, res) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findById(id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        await RecipeStep.deleteMany({ _id: { $in: recipe.steps } });
        await recipe.remove();

        res.json({ message: 'Recipe and associated steps deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};