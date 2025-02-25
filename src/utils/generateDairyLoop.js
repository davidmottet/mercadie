import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de produits laitiers pour amorcer la génération
const DAIRY_SUGGESTIONS = [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream', 
    'cottage cheese', 'mozzarella', 'cheddar', 'parmesan', 'ricotta', 'ice cream'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'unit', 'gram', 'kilogram', 'milliliter', 'liter', 'cup', 'tablespoon', 'piece', 'slice'
];

// Fonction pour générer le prompt système pour un produit laitier
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a dairy expert with access to:\n`;
    prompt += `- USDA Food Database\n- Dairy Association Resources\n- Nutritional Databases\n\n`;
    prompt += `Based on the dairy product name I give you, generate a JSON for this dairy product with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to true as dairy products are usually refrigerated\n`;
    prompt += `3. Set storeShelf to 3 (dairy section)\n`;
    prompt += `4. Include seasonal availability in seasons array (usually all year: [1-12])\n`;
    prompt += `5. Set appropriate grossWeight based on typical portion size\n`;
    prompt += `6. For cheese products, set appropriate values for fat content\n`;

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
        frozenOrCanned: true, // Les produits laitiers sont généralement réfrigérés
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année
        ignoreShoppingList: false,
        storeShelf: 3, // Rayon produits laitiers
        quantity: 1,
        grossWeight: 100 // Portion standard en grammes
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

// Fonction pour obtenir des suggestions de produits laitiers de l'IA
async function getSuggestedDairyProducts(baseDairy, processedDairy) {
    const aiProvider = getAIProvider('ollama');
    const existingDairyList = Array.from(processedDairy).join(', ');
    
    const prompt = `You are a dairy and food expert. I need 5 new dairy product suggestions related to "${baseDairy}".

IMPORTANT: DO NOT suggest any of these already existing dairy products: ${existingDairyList}

Return your response ONLY as a JSON array of 5 new dairy product names in English, like this example:
["dairy1", "dairy2", "dairy3", "dairy4", "dairy5"]

Make sure your suggestions are:
1. Real dairy products (milk-based)
2. Different from the existing dairy products listed above
3. Common enough to be found in grocery stores
4. Single dairy items (not prepared dishes)
5. Specific when possible (e.g. "greek yogurt" instead of just "yogurt")`;

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

async function generateSingleDairyProduct(dairyName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = dairyName.toLowerCase();

        // Vérifier si le produit laitier existe déjà
        let existingDairy = await Ingredient.findOne({ name: normalizedName });
        if (existingDairy) {
            console.log(`✓ Le produit laitier "${dairyName}" existe déjà`);
            return null;
        }

        // Générer les données du produit laitier
        console.log(`⚡ Génération des données pour le produit laitier "${dairyName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nDairy product to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingDairy = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingDairy) {
                console.log(`✓ Le produit laitier "${data.name}" a été généré mais existe déjà`);
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

            // Sauvegarder le nouveau produit laitier
            const newDairy = new Ingredient(lowerCaseData);
            await newDairy.save();
            console.log(`✅ Produit laitier "${data.name}" généré et sauvegardé avec succès`);
            return newDairy;

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
        console.error(`❌ Erreur lors de la génération du produit laitier "${dairyName}":`, error.message);
        return null;
    }
}

async function generateDairyLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedDairy = new Set();
        console.log('📝 Démarrage avec une liste vide de produits laitiers traités');

        let dairyToProcess = [...DAIRY_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (dairyToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseDairy = DAIRY_SUGGESTIONS[currentIndex % DAIRY_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseDairy}"...`);
                
                const newSuggestions = await getSuggestedDairyProducts(baseDairy, processedDairy);
                const filteredSuggestions = newSuggestions.filter(dairy => !processedDairy.has(dairy));
                
                if (filteredSuggestions.length > 0) {
                    dairyToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de produits laitiers ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain produit laitier de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre le prochain produit laitier de la file
            const currentDairy = dairyToProcess.shift();
            
            if (processedDairy.has(currentDairy)) {
                continue;
            }

            processedDairy.add(currentDairy);
            
            const result = await generateSingleDairyProduct(currentDairy);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedDairyProducts(currentDairy, processedDairy);
                const filteredSuggestions = newSuggestions.filter(dairy => !processedDairy.has(dairy));
                dairyToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Produits laitiers en attente: ${dairyToProcess.length}`);
            console.log(`Produits laitiers traités: ${processedDairy.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🥛 Démarrage de la génération de produits laitiers en boucle...');
generateDairyLoop(); 