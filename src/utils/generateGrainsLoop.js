import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de céréales et grains pour amorcer la génération
const GRAINS_SUGGESTIONS = [
    'rice', 'wheat', 'oats', 'quinoa', 'barley', 'corn', 'millet',
    'buckwheat', 'rye', 'bulgur', 'couscous', 'amaranth', 'spelt'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'gram', 'kilogram', 'cup', 'tablespoon', 'teaspoon'
];

// Fonction pour générer le prompt système pour une céréale/grain
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a grain and cereal expert with access to:\n`;
    prompt += `- USDA Food Database\n- Whole Grains Council data\n- Nutritional Databases\n\n`;
    prompt += `Based on the grain/cereal name I give you, generate a JSON for this grain with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to false as grains are typically dry\n`;
    prompt += `3. Set storeShelf to 4 (dry goods/pantry section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical portion size\n`;
    prompt += `6. Include accurate nutritional information, especially fiber and protein content\n`;

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
        frozenOrCanned: false, // Les céréales sont généralement sèches
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 4, // Rayon épicerie sèche
        quantity: 1,
        grossWeight: 100, // Portion standard en grammes
        type: 'grain' // Définir le type comme céréale/grain
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

// Fonction pour obtenir des suggestions de céréales/grains de l'IA
async function getSuggestedGrains(baseGrain, processedGrains) {
    const aiProvider = getAIProvider('ollama');
    const existingGrainsList = Array.from(processedGrains).join(', ');
    
    const prompt = `You are a grain and cereal expert. I need 5 new grain/cereal suggestions related to "${baseGrain}".

IMPORTANT: DO NOT suggest any of these already existing grains: ${existingGrainsList}

Return your response ONLY as a JSON array of 5 new grain/cereal names in English, like this example:
["grain1", "grain2", "grain3", "grain4", "grain5"]

Make sure your suggestions are:
1. Real grains, cereals, or similar dry goods
2. Different from the existing grains listed above
3. Common enough to be found in grocery stores
4. Single grain items (not prepared dishes)
5. Specific when possible (e.g. "brown rice" instead of just "rice")`;

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

async function generateSingleGrain(grainName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = grainName.toLowerCase();

        // Vérifier si la céréale existe déjà
        let existingGrain = await Ingredient.findOne({ name: normalizedName });
        if (existingGrain) {
            console.log(`✓ La céréale/grain "${grainName}" existe déjà`);
            return null;
        }

        // Générer les données de la céréale
        console.log(`⚡ Génération des données pour la céréale/grain "${grainName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nGrain/cereal to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingGrain = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingGrain) {
                console.log(`✓ La céréale/grain "${data.name}" a été généré mais existe déjà`);
                return null;
            }

            // Gérer l'unité de mesure
            let measurementUnit = data.measurementUnit || 'gram';

            // Vérifier que measurementUnit est une chaîne de caractères
            if (typeof measurementUnit !== 'string') {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "gram" par défaut`);
                measurementUnit = 'gram';
            } else {
                measurementUnit = measurementUnit.toLowerCase();
            }

            // Valider l'unité de mesure
            if (!VALID_MEASUREMENT_UNITS.includes(measurementUnit)) {
                console.log(`⚠️ Unité de mesure invalide "${measurementUnit}", utilisation de "gram" par défaut`);
                measurementUnit = 'gram';
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

            // Sauvegarder la nouvelle céréale
            const newGrain = new Ingredient(lowerCaseData);
            await newGrain.save();
            console.log(`✅ Céréale/grain "${data.name}" généré et sauvegardé avec succès`);
            return newGrain;

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
        console.error(`❌ Erreur lors de la génération de la céréale/grain "${grainName}":`, error.message);
        return null;
    }
}

async function generateGrainsLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedGrains = new Set();
        console.log('📝 Démarrage avec une liste vide de céréales/grains traités');

        let grainsToProcess = [...GRAINS_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (grainsToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseGrain = GRAINS_SUGGESTIONS[currentIndex % GRAINS_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseGrain}"...`);
                
                const newSuggestions = await getSuggestedGrains(baseGrain, processedGrains);
                const filteredSuggestions = newSuggestions.filter(grain => !processedGrains.has(grain));
                
                if (filteredSuggestions.length > 0) {
                    grainsToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de céréales/grains ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage à la prochaine céréale/grain de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre la prochaine céréale de la file
            const currentGrain = grainsToProcess.shift();
            
            if (processedGrains.has(currentGrain)) {
                continue;
            }

            processedGrains.add(currentGrain);
            
            const result = await generateSingleGrain(currentGrain);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedGrains(currentGrain, processedGrains);
                const filteredSuggestions = newSuggestions.filter(grain => !processedGrains.has(grain));
                grainsToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Céréales/grains en attente: ${grainsToProcess.length}`);
            console.log(`Céréales/grains traités: ${processedGrains.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🌾 Démarrage de la génération de céréales et grains en boucle...');
generateGrainsLoop(); 