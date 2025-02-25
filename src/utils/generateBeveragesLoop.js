import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de boissons pour amorcer la génération
const BEVERAGES_SUGGESTIONS = [
    'water', 'coffee', 'tea', 'orange juice', 'apple juice', 'milk', 'soda',
    'lemonade', 'beer', 'wine', 'smoothie', 'coconut water', 'energy drink'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'milliliter', 'liter', 'cup', 'tablespoon', 'teaspoon'
];

// Fonction pour générer le prompt système pour une boisson
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a beverage expert with access to:\n`;
    prompt += `- USDA Food Database\n- Beverage Industry Reports\n- Nutritional Databases\n\n`;
    prompt += `Based on the beverage name I give you, generate a JSON for this beverage with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to false unless it's a frozen beverage\n`;
    prompt += `3. Set storeShelf to 6 (beverage section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical serving size\n`;
    prompt += `6. Include accurate nutritional information, especially sugar and calorie content\n`;

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
            return field.caster.instance === 'Number' ? '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]' : '[]';
        case 'ObjectID':
            return 'null';
        default:
            return 'null';
    }
}

// Fonction pour valider et compléter les données manquantes
function validateAndCompleteData(data) {
    const defaultValues = {
        frozenOrCanned: false, // La plupart des boissons ne sont pas congelées
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 6, // Rayon boissons
        quantity: 1,
        grossWeight: 250, // Portion standard en millilitres
        type: 'beverage' // Définir le type comme boisson
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

// Fonction pour obtenir des suggestions de boissons de l'IA
async function getSuggestedBeverages(baseBeverage, processedBeverages) {
    const aiProvider = getAIProvider('ollama');
    const existingBeveragesList = Array.from(processedBeverages).join(', ');
    
    const prompt = `You are a beverage expert. I need 5 new beverage suggestions related to "${baseBeverage}".

IMPORTANT: DO NOT suggest any of these already existing beverages: ${existingBeveragesList}

Return your response ONLY as a JSON array of 5 new beverage names in English, like this example:
["beverage1", "beverage2", "beverage3", "beverage4", "beverage5"]

Make sure your suggestions are:
1. Real beverages that people drink
2. Different from the existing beverages listed above
3. Common enough to be found in grocery stores
4. Single beverage items (not cocktails or mixed drinks)
5. Specific when possible (e.g. "green tea" instead of just "tea")`;

    try {
        console.log('Envoi de la requête pour obtenir des suggestions...');
        try {
            const suggestions = await aiProvider.generateCompletion(prompt);
            console.log('Réponse reçue de l\'API pour les suggestions');
            
            if (Array.isArray(suggestions)) {
                return suggestions.map(s => s.toLowerCase().trim());
            }
            console.log('Format de réponse invalide de l\'IA:', suggestions);
            return [];
        } catch (fetchError) {
            console.error('Détails de l\'erreur de fetch pour les suggestions:');
            console.error('- Message:', fetchError.message);
            console.error('- Cause:', fetchError.cause);
            console.error('- Type:', fetchError.name);
            console.error('- Stack:', fetchError.stack);
            if (fetchError.response) {
                console.error('- Status:', fetchError.response.status);
                console.error('- StatusText:', fetchError.response.statusText);
                try {
                    const errorBody = await fetchError.response.text();
                    console.error('- Response body:', errorBody);
                } catch (e) {
                    console.error('- Impossible de lire le corps de la réponse');
                }
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('Erreur lors de la génération des suggestions:', error);
        return [];
    }
}

async function generateSingleBeverage(beverageName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = beverageName.toLowerCase();

        // Vérifier si la boisson existe déjà
        let existingBeverage = await Ingredient.findOne({ name: normalizedName });
        if (existingBeverage) {
            console.log(`✓ La boisson "${beverageName}" existe déjà`);
            return null;
        }

        // Générer les données de la boisson
        console.log(`⚡ Génération des données pour la boisson "${beverageName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nBeverage to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingBeverage = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingBeverage) {
                console.log(`✓ La boisson "${data.name}" a été générée mais existe déjà`);
                return null;
            }

            // Gérer l'unité de mesure
            let measurementUnit = data.measurementUnit || 'milliliter';

            // Vérifier que measurementUnit est une chaîne de caractères
            if (typeof measurementUnit !== 'string') {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "milliliter" par défaut`);
                measurementUnit = 'milliliter';
            } else {
                measurementUnit = measurementUnit.toLowerCase();
            }

            // Valider l'unité de mesure
            if (!VALID_MEASUREMENT_UNITS.includes(measurementUnit)) {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "milliliter" par défaut`);
                measurementUnit = 'milliliter';
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

            // Sauvegarder la nouvelle boisson
            const newBeverage = new Ingredient(lowerCaseData);
            await newBeverage.save();
            console.log(`✅ Boisson "${data.name}" générée et sauvegardée avec succès`);
            return newBeverage;

        } catch (fetchError) {
            console.error('Détails de l\'erreur de fetch:');
            console.error('- Message:', fetchError.message);
            console.error('- Cause:', fetchError.cause);
            console.error('- Type:', fetchError.name);
            console.error('- Stack:', fetchError.stack);
            if (fetchError.response) {
                console.error('- Status:', fetchError.response.status);
                console.error('- StatusText:', fetchError.response.statusText);
                try {
                    const errorBody = await fetchError.response.text();
                    console.error('- Response body:', errorBody);
                } catch (e) {
                    console.error('- Impossible de lire le corps de la réponse');
                }
            }
            throw fetchError;
        }

    } catch (error) {
        console.error(`❌ Erreur lors de la génération de la boisson "${beverageName}":`, error.message);
        return null;
    }
}

async function generateBeveragesLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedBeverages = new Set();
        console.log('📝 Démarrage avec une liste vide de boissons traitées');

        let beveragesToProcess = [...BEVERAGES_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (beveragesToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseBeverage = BEVERAGES_SUGGESTIONS[currentIndex % BEVERAGES_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseBeverage}"...`);
                
                const newSuggestions = await getSuggestedBeverages(baseBeverage, processedBeverages);
                const filteredSuggestions = newSuggestions.filter(beverage => !processedBeverages.has(beverage));
                
                if (filteredSuggestions.length > 0) {
                    beveragesToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de boissons ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage à la prochaine boisson de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre la prochaine boisson de la file
            const currentBeverage = beveragesToProcess.shift();
            
            if (processedBeverages.has(currentBeverage)) {
                continue;
            }

            processedBeverages.add(currentBeverage);
            
            const result = await generateSingleBeverage(currentBeverage);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedBeverages(currentBeverage, processedBeverages);
                const filteredSuggestions = newSuggestions.filter(beverage => !processedBeverages.has(beverage));
                beveragesToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Boissons en attente: ${beveragesToProcess.length}`);
            console.log(`Boissons traitées: ${processedBeverages.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🥤 Démarrage de la génération de boissons en boucle...');
generateBeveragesLoop(); 