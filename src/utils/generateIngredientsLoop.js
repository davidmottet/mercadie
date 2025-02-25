import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste de suggestions d'ingrédients pour amorcer la génération
const INGREDIENT_SUGGESTIONS = [
    'carrot', 'apple', 'chicken', 'rice', 'tomato', 'beef', 'potato', 'salmon',
    'spinach', 'milk', 'egg', 'onion', 'garlic', 'banana', 'pasta', 'cheese',
    'broccoli', 'pork', 'mushroom', 'cucumber'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'unit', 'gram', 'kilogram', 'milliliter', 'liter', 'teaspoon', 'tablespoon',
    'cup', 'ounce', 'pound', 'piece', 'slice', 'bunch', 'clove'
];

// Fonction pour générer le prompt système
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `NutriGen, nutrition expert. Access:\n`;
    prompt += `- Ciqual 2024\n- ANSES\n- USDA\n- Recent publications\n\n`;
    prompt += `Based on the ingredient name I give you, generate a JSON for this ingredient with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT: For the measurementUnit field, use ONLY one of these values:\n`;
    prompt += VALID_MEASUREMENT_UNITS.join(', ') + '\n';
    prompt += `If unsure, use "unit" as default.\n`;

    return prompt;
}

function getExampleValue(field) {
    switch (field.instance) {
        case 'String':
            return `"String"`;
        case 'Number':
            return 0;
        case 'Boolean':
            return false;
        case 'Array':
            return field.caster.instance === 'Number' ? '[0, 1, 2]' : '[]';
        case 'ObjectID':
            return 'null';
        default:
            return 'null';
    }
}

async function checkIngredientExistence(name) {
    return await Ingredient.findOne({ name: name.toLowerCase() });
}

// Fonction pour valider et compléter les données manquantes
function validateAndCompleteData(data) {
    const defaultValues = {
        frozenOrCanned: false,
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        ignoreShoppingList: false,
        storeShelf: 1,
        quantity: 1,
        grossWeight: 1,
        type: 'other'
    };

    // S'assurer que tous les champs requis sont présents
    for (const [key, value] of Object.entries(defaultValues)) {
        if (!(key in data) || data[key] === null || data[key] === undefined) {
            data[key] = value;
        }
    }

    // S'assurer que les champs de texte sont présents
    if (!data.displayName) data.displayName = data.name;
    if (!data.displayPlural) data.displayPlural = data.name + 's';
    if (!data.plural) data.plural = data.name + 's';

    return data;
}

async function generateSingleIngredient(ingredientName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = ingredientName.toLowerCase();

        // Vérifier si l'ingrédient existe déjà
        let existingIngredient = await checkIngredientExistence(normalizedName);
        if (existingIngredient) {
            console.log(`✓ L'ingrédient "${ingredientName}" existe déjà`);
            return null;
        }

        // Générer les données de l'ingrédient
        console.log(`⚡ Génération des données pour "${ingredientName}"...`);
        const data = await aiProvider.generateCompletion(systemPrompt + `\nIngredient to analyze: ${normalizedName}`);

        if (!('name' in data)) {
            throw new Error('Structure JSON invalide : nom manquant');
        }

        // Vérifier à nouveau après la génération
        existingIngredient = await checkIngredientExistence(data.name);
        if (existingIngredient) {
            console.log(`✓ L'ingrédient "${data.name}" a été généré mais existe déjà`);
            return null;
        }

        // Gérer l'unité de mesure
        let measurementUnit = data.measurementUnit || 'unit';

        // Vérifier que measurementUnit est une chaîne de caractères
        if (typeof measurementUnit !== 'string') {
            console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "unit" par défaut`);
            measurementUnit = 'unit';
        } else {
            measurementUnit = measurementUnit.toLowerCase();
        }

        // Valider l'unité de mesure
        if (!VALID_MEASUREMENT_UNITS.includes(measurementUnit)) {
            console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "unit" par défaut`);
            measurementUnit = 'unit';
        }

        let measurementUnitDoc = await MeasurementUnit.findOne({ name: measurementUnit });
        if (!measurementUnitDoc) {
            measurementUnitDoc = new MeasurementUnit({ 
                name: measurementUnit
            });
            await measurementUnitDoc.save();
        }
        data.measurementUnit = measurementUnitDoc._id;

        // Valider et compléter les données manquantes
        const validatedData = validateAndCompleteData(data);

        // Convertir les chaînes en minuscules
        const lowerCaseData = {};
        for (const key in validatedData) {
            if (typeof validatedData[key] === 'string') {
                lowerCaseData[key] = validatedData[key].toLowerCase();
            } else {
                lowerCaseData[key] = validatedData[key];
            }
        }

        // Sauvegarder le nouvel ingrédient
        const newIngredient = new Ingredient(lowerCaseData);
        await newIngredient.save();
        console.log(`✅ Ingrédient "${data.name}" généré et sauvegardé avec succès`);
        return newIngredient;

    } catch (error) {
        console.error(`❌ Erreur lors de la génération de "${ingredientName}":`, error.message);
        return null;
    }
}

// Fonction pour obtenir des suggestions d'ingrédients de l'IA
async function getSuggestedIngredients(baseIngredient, processedIngredients) {
    const aiProvider = getAIProvider('ollama');
    const existingIngredientsList = Array.from(processedIngredients).join(', ');
    
    const prompt = `You are a culinary expert. I need 5 new ingredient suggestions related to "${baseIngredient}".

IMPORTANT: DO NOT suggest any of these already existing ingredients: ${existingIngredientsList}

Return your response ONLY as a JSON array of 5 new ingredient names in English, like this example:
["ingredient1", "ingredient2", "ingredient3", "ingredient4", "ingredient5"]

Make sure your suggestions are:
1. Real food ingredients
2. Different from the existing ingredients listed above
3. Related to ${baseIngredient} (similar category, usage, or cuisine)
4. Common enough to be found in stores
5. Single ingredients (not recipes or dishes)`;

    try {
        const suggestions = await aiProvider.generateCompletion(prompt);
        if (Array.isArray(suggestions)) {
            return suggestions.map(s => s.toLowerCase().trim());
        }
        console.log('Format de réponse invalide de l\'IA:', suggestions);
        return [];
    } catch (error) {
        console.error('Erreur lors de la génération des suggestions:', error);
        return [];
    }
}

async function generateIngredientsLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Charger les ingrédients existants de la base de données
        const existingIngredients = await Ingredient.find({}, 'name');
        let processedIngredients = new Set(existingIngredients.map(ing => ing.name.toLowerCase()));
        console.log(`📝 ${processedIngredients.size} ingrédients existants chargés de la base de données`);

        let ingredientsToProcess = [...INGREDIENT_SUGGESTIONS]; // File d'attente des ingrédients à traiter
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            // Si la file d'attente est vide ou si on a fait trop de tentatives sans succès,
            // générer de nouvelles suggestions
            if (ingredientsToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseIngredient = INGREDIENT_SUGGESTIONS[currentIndex % INGREDIENT_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseIngredient}"...`);
                
                const newSuggestions = await getSuggestedIngredients(baseIngredient, processedIngredients);
                const filteredSuggestions = newSuggestions.filter(ing => !processedIngredients.has(ing));
                
                if (filteredSuggestions.length > 0) {
                    ingredientsToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain ingrédient de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre le prochain ingrédient de la file
            const ingredientToProcess = ingredientsToProcess.shift();
            
            // Vérifier si on l'a déjà traité
            if (processedIngredients.has(ingredientToProcess)) {
                continue;
            }

            // Marquer comme traité
            processedIngredients.add(ingredientToProcess);
            
            // Générer l'ingrédient
            const result = await generateSingleIngredient(ingredientToProcess);
            
            if (result) {
                successCount++;
                // Ajouter de nouvelles suggestions basées sur le succès
                const newSuggestions = await getSuggestedIngredients(ingredientToProcess, processedIngredients);
                const filteredSuggestions = newSuggestions.filter(ing => !processedIngredients.has(ing));
                ingredientsToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Ingrédients en attente: ${ingredientsToProcess.length}`);
            console.log(`Ingrédients traités: ${processedIngredients.size}`);
            console.log('===================\n');

            // Attendre un peu entre chaque génération
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🚀 Démarrage de la génération d\'ingrédients en boucle...');
generateIngredientsLoop();