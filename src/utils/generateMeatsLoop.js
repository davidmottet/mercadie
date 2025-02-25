import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de viandes pour amorcer la génération
const MEAT_SUGGESTIONS = [
    'beef', 'chicken', 'pork', 'lamb', 'turkey', 'duck', 
    'veal', 'venison', 'rabbit', 'goat', 'bison', 'ham'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'unit', 'gram', 'kilogram', 'piece', 'slice', 'pound'
];

// Fonction pour générer le prompt système pour une viande
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a meat and protein expert with access to:\n`;
    prompt += `- USDA Food Database\n- Meat Science Association\n- Culinary Institute Resources\n\n`;
    prompt += `Based on the meat name I give you, generate a JSON for this meat with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to true as meats are usually refrigerated or frozen\n`;
    prompt += `3. Set storeShelf to 2 (meat/refrigerated section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical portion size\n`;
    prompt += `6. For pork products, set withPork to true\n`;

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
        frozenOrCanned: true, // Les viandes sont généralement réfrigérées
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 2, // Rayon viandes/réfrigéré
        quantity: 1,
        grossWeight: 150 // Portion standard de viande en grammes
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

    // Vérifier si c'est du porc
    if (data.name && (
        data.name.includes('pork') || 
        data.name.includes('ham') || 
        data.name.includes('bacon') || 
        data.name.includes('sausage') ||
        data.name.includes('pig')
    )) {
        data.withPork = true;
    }

    return data;
}

// Fonction pour obtenir des suggestions de viandes de l'IA
async function getSuggestedMeats(baseMeat, processedMeats) {
    const aiProvider = getAIProvider('ollama');
    const existingMeatsList = Array.from(processedMeats).join(', ');
    
    const prompt = `You are a meat and culinary expert. I need 5 new meat suggestions related to "${baseMeat}".

IMPORTANT: DO NOT suggest any of these already existing meats: ${existingMeatsList}

Return your response ONLY as a JSON array of 5 new meat names in English, like this example:
["meat1", "meat2", "meat3", "meat4", "meat5"]

Make sure your suggestions are:
1. Real edible meats or meat cuts
2. Different from the existing meats listed above
3. Common enough to be found in grocery stores or butcher shops
4. Single meat types or cuts (not prepared dishes)
5. Specific cuts when possible (e.g. "ribeye steak" instead of just "beef")`;

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

async function generateSingleMeat(meatName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = meatName.toLowerCase();

        // Vérifier si la viande existe déjà
        let existingMeat = await Ingredient.findOne({ name: normalizedName });
        if (existingMeat) {
            console.log(`✓ La viande "${meatName}" existe déjà`);
            return null;
        }

        // Générer les données de la viande
        console.log(`⚡ Génération des données pour la viande "${meatName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nMeat to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingMeat = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingMeat) {
                console.log(`✓ La viande "${data.name}" a été générée mais existe déjà`);
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

            // Sauvegarder la nouvelle viande
            const newMeat = new Ingredient(lowerCaseData);
            await newMeat.save();
            console.log(`✅ Viande "${data.name}" générée et sauvegardée avec succès`);
            return newMeat;

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
            throw fetchError; // Relancer l'erreur pour la gestion plus haut
        }

    } catch (error) {
        console.error(`❌ Erreur lors de la génération de la viande "${meatName}":`, error.message);
        return null;
    }
}

async function generateMeatsLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedMeats = new Set();
        console.log('📝 Démarrage avec une liste vide de viandes traitées');

        let meatsToProcess = [...MEAT_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (meatsToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseMeat = MEAT_SUGGESTIONS[currentIndex % MEAT_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseMeat}"...`);
                
                const newSuggestions = await getSuggestedMeats(baseMeat, processedMeats);
                const filteredSuggestions = newSuggestions.filter(meat => !processedMeats.has(meat));
                
                if (filteredSuggestions.length > 0) {
                    meatsToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de viandes ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage à la prochaine viande de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre la prochaine viande de la file
            const currentMeat = meatsToProcess.shift();
            
            if (processedMeats.has(currentMeat)) {
                continue;
            }

            processedMeats.add(currentMeat);
            
            const result = await generateSingleMeat(currentMeat);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedMeats(currentMeat, processedMeats);
                const filteredSuggestions = newSuggestions.filter(meat => !processedMeats.has(meat));
                meatsToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Viandes en attente: ${meatsToProcess.length}`);
            console.log(`Viandes traitées: ${processedMeats.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🥩 Démarrage de la génération de viandes en boucle...');
generateMeatsLoop(); 