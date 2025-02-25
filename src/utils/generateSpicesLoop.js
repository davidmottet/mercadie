import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale d'épices et herbes pour amorcer la génération
const SPICES_SUGGESTIONS = [
    'pepper', 'cinnamon', 'basil', 'thyme', 'oregano', 'rosemary', 'cumin',
    'paprika', 'turmeric', 'ginger', 'nutmeg', 'cardamom', 'cloves', 'saffron'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'gram', 'teaspoon', 'tablespoon', 'pinch'
];

// Fonction pour générer le prompt système pour une épice/herbe
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a spice and herb expert with access to:\n`;
    prompt += `- USDA Food Database\n- Spice Trade Association data\n- Culinary Herb Encyclopedia\n\n`;
    prompt += `Based on the spice/herb name I give you, generate a JSON for this spice with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to false as spices are typically dry\n`;
    prompt += `3. Set storeShelf to 5 (spice section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical portion size (usually small for spices)\n`;
    prompt += `6. Include information about flavor profile and culinary uses\n`;

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
        frozenOrCanned: false, // Les épices sont généralement sèches
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 5, // Rayon épices
        quantity: 1,
        grossWeight: 5 // Portion standard en grammes (petite pour les épices)
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

// Fonction pour obtenir des suggestions d'épices/herbes de l'IA
async function getSuggestedSpices(baseSpice, processedSpices) {
    const aiProvider = getAIProvider('ollama');
    const existingSpicesList = Array.from(processedSpices).join(', ');
    
    const prompt = `You are a spice and herb expert. I need 5 new spice/herb suggestions related to "${baseSpice}".

IMPORTANT: DO NOT suggest any of these already existing spices: ${existingSpicesList}

Return your response ONLY as a JSON array of 5 new spice/herb names in English, like this example:
["spice1", "spice2", "spice3", "spice4", "spice5"]

Make sure your suggestions are:
1. Real spices, herbs, or seasonings
2. Different from the existing spices listed above
3. Common enough to be found in grocery stores
4. Single spice items (not spice blends)
5. Specific when possible (e.g. "sweet basil" instead of just "basil")`;

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

async function generateSingleSpice(spiceName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = spiceName.toLowerCase();

        // Vérifier si l'épice existe déjà
        let existingSpice = await Ingredient.findOne({ name: normalizedName });
        if (existingSpice) {
            console.log(`✓ L'épice/herbe "${spiceName}" existe déjà`);
            return null;
        }

        // Générer les données de l'épice
        console.log(`⚡ Génération des données pour l'épice/herbe "${spiceName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nSpice/herb to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingSpice = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingSpice) {
                console.log(`✓ L'épice/herbe "${data.name}" a été générée mais existe déjà`);
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

            // Sauvegarder la nouvelle épice
            const newSpice = new Ingredient(lowerCaseData);
            await newSpice.save();
            console.log(`✅ Épice/herbe "${data.name}" générée et sauvegardée avec succès`);
            return newSpice;

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
        console.error(`❌ Erreur lors de la génération de l'épice/herbe "${spiceName}":`, error.message);
        return null;
    }
}

async function generateSpicesLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedSpices = new Set();
        console.log('📝 Démarrage avec une liste vide d\'épices/herbes traitées');

        let spicesToProcess = [...SPICES_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (spicesToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseSpice = SPICES_SUGGESTIONS[currentIndex % SPICES_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseSpice}"...`);
                
                const newSuggestions = await getSuggestedSpices(baseSpice, processedSpices);
                const filteredSuggestions = newSuggestions.filter(spice => !processedSpices.has(spice));
                
                if (filteredSuggestions.length > 0) {
                    spicesToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions d'épices/herbes ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage à la prochaine épice/herbe de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre la prochaine épice de la file
            const currentSpice = spicesToProcess.shift();
            
            if (processedSpices.has(currentSpice)) {
                continue;
            }

            processedSpices.add(currentSpice);
            
            const result = await generateSingleSpice(currentSpice);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedSpices(currentSpice, processedSpices);
                const filteredSuggestions = newSuggestions.filter(spice => !processedSpices.has(spice));
                spicesToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Épices/herbes en attente: ${spicesToProcess.length}`);
            console.log(`Épices/herbes traitées: ${processedSpices.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🌶️ Démarrage de la génération d\'épices et herbes en boucle...');
generateSpicesLoop(); 