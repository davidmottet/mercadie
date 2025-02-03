import mongoose from 'mongoose';

const recipeStepSchema = new mongoose.Schema({
    order: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    image: String,
    imageAlt: String,
    familyProfile: String,
    video: String,
    ingredients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ingredient'
    }]
});

const RecipeStep = mongoose.model('RecipeStep', recipeStepSchema);

export default RecipeStep;