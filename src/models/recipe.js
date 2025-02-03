import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true
    },
    preparationTime: {
        type: Number,
        required: true
    },
    bakingTime: {
        type: Number,
        required: true
    },
    restTime: {
        type: Number,
        required: true
    },
    benefits: {
        type: String,
        required: true
    },
    portions: {
        type: Number,
        required: true
    },
    minPortions: Number,
    maxPortions: Number,
    mainComponent: {
        type: String,
        required: true
    },
    unbreakable: Boolean,
    image: {
        type: String,
        required: true
    },
    imageAlt: String,
    coverDesktop: String,
    coverMobile: String,
    coverAlt: String,
    video: String,
    publicationPlatforms: [String],
    published: {
        type: Boolean,
        required: true
    },
    archived: {
        type: Boolean,
        required: true
    },
    recipeCategory: {
        type: String,
        required: true
    },
    ranking: {
        type: String,
        required: true
    },
    seasons: [String],
    express: {
        type: Boolean,
        required: true
    },
    nutriscore: {
        type: String,
        required: true
    },
    kcalPer100g: {
        type: Number,
        required: true
    },
    kjPer100g: {
        type: Number,
        required: true
    },
    lipidsPer100g: {
        type: Number,
        required: true
    },
    saturatedFattyAcidsPer100g: {
        type: Number,
        required: true
    },
    carbohydratesPer100g: {
        type: Number,
        required: true
    },
    simpleSugarsPer100g: {
        type: Number,
        required: true
    },
    fibresPer100g: {
        type: Number,
        required: true
    },
    saltPer100g: {
        type: Number,
        required: true
    },
    pnnsFruitPer100g: {
        type: Number,
        required: true
    },
    pnnsVegetablePer100g: {
        type: Number,
        required: true
    },
    oilsPer100g: {
        type: Number,
        required: true
    },
    pnnsNutsPer100g: {
        type: Number,
        required: true
    },
    pnnsDriedVegetablePer100g: {
        type: Number,
        required: true
    },
    proteinsPer100g: {
        type: Number,
        required: true
    },
    familyRecipe: {
        type: Boolean,
        required: true
    },
    parent: {
        type: Boolean,
        required: true
    },
    tags: [String],
    steps: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecipeStep'
    }],
    ingredients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ingredient'
    }],
    childrenRecipes: [mongoose.Schema.Types.Mixed]
});

const Recipe = mongoose.model('Recipe', recipeSchema);

export default Recipe;