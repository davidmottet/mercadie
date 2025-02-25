import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de condiments pour amorcer la génération
const CONDIMENTS_SUGGESTIONS = [
    'ketchup', 'mustard', 'mayonnaise', 'soy sauce', 'hot sauce', 'vinegar',
    'olive oil', 'salsa', 'pesto', 'bbq sauce', 'honey', 'maple syrup', 'jam'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'gram', 'milliliter', 'tablespoon', 'teaspoon', 'cup'
];

// Fonction pour générer le prompt système pour un condiment
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a condiment and sauce expert with access to:\n`;
    prompt += `- USDA Food Database\n- Culinary Institutes Data\n- Nutritional Databases\n\n`;
    prompt += `Based on the condiment/sauce name I give you, generate a JSON for this condiment with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to false unless it's a refrigerated condiment\n`;
    prompt += `3. Set storeShelf to 5 (condiment section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical serving size\n`;
    prompt += `6. Include accurate nutritional information, especially sodium and sugar content\n`;

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
        frozenOrCanned: false, // La plupart des condiments ne sont pas congelés
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 5, // Rayon condiments
        quantity: 1,
        grossWeight: 15, // Portion standard en grammes/millilitres
        type: 'condiment' // Définir le type comme condiment
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

// Fonction pour obtenir des suggestions de condiments de l'IA
async function getSuggestedCondiments(baseCondiment, processedCondiments) {
    const aiProvider = getAIProvider('ollama');
    const existingCondimentsList = Array.from(processedCondiments).join(', ');
    
    const prompt = `You are a condiment and sauce expert. I need 5 new condiment/sauce suggestions related to "${baseCondiment}".

IMPORTANT: DO NOT suggest any of these already existing condiments: ${existingCondimentsList}

Return your response ONLY as a JSON array of 5 new condiment/sauce names in English, like this example:
["condiment1", "condiment2", "condiment3", "condiment4", "condiment5"]

Make sure your suggestions are:
1. Real condiments, sauces, or dressings used to flavor food
2. Different from the existing condiments listed above
3. Common enough to be found in grocery stores
4. Single condiment items (not recipes or dishes)
5. Specific when possible (e.g. "dijon mustard" instead of just "mustard")`;

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

async function generateSingleCondiment(condimentName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = condimentName.toLowerCase();

        // Vérifier si le condiment existe déjà
        let existingCondiment = await Ingredient.findOne({ name: normalizedName });
        if (existingCondiment) {
            console.log(`✓ Le condiment "${condimentName}" existe déjà`);
            return null;
        }

        // Générer les données du condiment
        console.log(`⚡ Génération des données pour le condiment "${condimentName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nCondiment/sauce to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingCondiment = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingCondiment) {
                console.log(`✓ Le condiment "${data.name}" a été généré mais existe déjà`);
                return null;
            }

            // Gérer l'unité de mesure
            let measurementUnit = data.measurementUnit || 'tablespoon';

            // Vérifier que measurementUnit est une chaîne de caractères
            if (typeof measurementUnit !== 'string') {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "tablespoon" par défaut`);
                measurementUnit = 'tablespoon';
            } else {
                measurementUnit = measurementUnit.toLowerCase();
            }

            // Valider l'unité de mesure
            if (!VALID_MEASUREMENT_UNITS.includes(measurementUnit)) {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "tablespoon" par défaut`);
                measurementUnit = 'tablespoon';
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

            // Sauvegarder le nouveau condiment
            const newCondiment = new Ingredient(lowerCaseData);
            await newCondiment.save();
            console.log(`✅ Condiment "${data.name}" généré et sauvegardé avec succès`);
            return newCondiment;

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
        console.error(`❌ Erreur lors de la génération du condiment "${condimentName}":`, error.message);
        return null;
    }
}

async function generateCondimentsLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedCondiments = new Set();
        console.log('📝 Démarrage avec une liste vide de condiments traités');

        let condimentsToProcess = [...CONDIMENTS_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (condimentsToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseCondiment = CONDIMENTS_SUGGESTIONS[currentIndex % CONDIMENTS_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseCondiment}"...`);
                
                const newSuggestions = await getSuggestedCondiments(baseCondiment, processedCondiments);
                const filteredSuggestions = newSuggestions.filter(condiment => !processedCondiments.has(condiment));
                
                if (filteredSuggestions.length > 0) {
                    condimentsToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de condiments ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain condiment de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre le prochain condiment de la file
            const currentCondiment = condimentsToProcess.shift();
            
            if (processedCondiments.has(currentCondiment)) {
                continue;
            }

            processedCondiments.add(currentCondiment);
            
            const result = await generateSingleCondiment(currentCondiment);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedCondiments(currentCondiment, processedCondiments);
                const filteredSuggestions = newSuggestions.filter(condiment => !processedCondiments.has(condiment));
                condimentsToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Condiments en attente: ${condimentsToProcess.length}`);
            console.log(`Condiments traités: ${processedCondiments.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🧂 Démarrage de la génération de condiments en boucle...');
generateCondimentsLoop(); 