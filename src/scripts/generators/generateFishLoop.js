import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de poissons pour amorcer la génération
const FISH_SUGGESTIONS = [
    'salmon', 'tuna', 'cod', 'haddock', 'trout', 'seabass', 'mackerel',
    'sardine', 'halibut', 'tilapia'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'unit', 'gram', 'kilogram', 'piece', 'slice'
];

// Fonction pour générer le prompt système pour un poisson
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a fish and seafood expert with access to:\n`;
    prompt += `- FAO Fish Database\n- Seafood Watch Guide\n- Marine Conservation Society Data\n\n`;
    prompt += `Based on the fish name I give you, generate a JSON for this fish with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to true as fish is usually frozen\n`;
    prompt += `3. Set storeShelf to 2 (refrigerated section)\n`;
    prompt += `4. Include seasonal availability in seasons array\n`;
    prompt += `5. Set appropriate grossWeight based on typical portion size\n`;

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
        frozenOrCanned: true, // Par défaut true pour les poissons
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année si congelé
        ignoreShoppingList: false,
        storeShelf: 2, // Rayon réfrigéré/congelé
        quantity: 1,
        grossWeight: 150, // Portion standard de poisson en grammes
        type: 'fish' // Définir le type comme poisson
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

// Fonction pour obtenir des suggestions de poissons de l'IA
async function getSuggestedFish(baseFish, processedFish) {
    const aiProvider = getAIProvider('ollama');
    const existingFishList = Array.from(processedFish).join(', ');
    
    const prompt = `You are a marine biology and seafood expert. I need 5 new fish species suggestions related to "${baseFish}".

IMPORTANT: DO NOT suggest any of these already existing fish: ${existingFishList}

Return your response ONLY as a JSON array of 5 new fish names in English, like this example:
["fish1", "fish2", "fish3", "fish4", "fish5"]

Make sure your suggestions are:
1. Real fish species used for food
2. Different from the existing fish listed above
3. Common enough to be found in fish markets or supermarkets
4. Single species (not general categories)
5. Edible fish species (not decorative or non-food fish)`;

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

async function generateSingleFish(fishName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = fishName.toLowerCase();

        // Vérifier si le poisson existe déjà
        let existingFish = await Ingredient.findOne({ name: normalizedName });
        if (existingFish) {
            console.log(`✓ Le poisson "${fishName}" existe déjà`);
            return null;
        }

        // Générer les données du poisson
        console.log(`⚡ Génération des données pour le poisson "${fishName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nFish to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingFish = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingFish) {
                console.log(`✓ Le poisson "${data.name}" a été généré mais existe déjà`);
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

            // Sauvegarder le nouveau poisson
            const newFish = new Ingredient(lowerCaseData);
            await newFish.save();
            console.log(`✅ Poisson "${data.name}" généré et sauvegardé avec succès`);
            return newFish;

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
        console.error(`❌ Erreur lors de la génération du poisson "${fishName}":`, error.message);
        return null;
    }
}

async function generateFishLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // // Charger les poissons existants de la base de données
        // const existingFish = await Ingredient.find({}, 'name');
        // let processedFish = new Set(existingFish.map(fish => fish.name.toLowerCase()));
        // console.log(`📝 ${processedFish.size} poissons existants chargés de la base de données`);

        // Commencer avec une liste vide
        let processedFish = new Set();
        console.log('📝 Démarrage avec une liste vide de poissons traités');

        let fishToProcess = [...FISH_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (fishToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseFish = FISH_SUGGESTIONS[currentIndex % FISH_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseFish}"...`);
                
                const newSuggestions = await getSuggestedFish(baseFish, processedFish);
                const filteredSuggestions = newSuggestions.filter(fish => !processedFish.has(fish));
                
                if (filteredSuggestions.length > 0) {
                    fishToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de poissons ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain poisson de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre le prochain poisson de la file
            const currentFish = fishToProcess.shift();
            
            if (processedFish.has(currentFish)) {
                continue;
            }

            processedFish.add(currentFish);
            
            const result = await generateSingleFish(currentFish);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedFish(currentFish, processedFish);
                const filteredSuggestions = newSuggestions.filter(fish => !processedFish.has(fish));
                fishToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Poissons en attente: ${fishToProcess.length}`);
            console.log(`Poissons traités: ${processedFish.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🐟 Démarrage de la génération de poissons en boucle...');
generateFishLoop(); 