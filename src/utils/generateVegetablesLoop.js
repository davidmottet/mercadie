import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

// Liste initiale de légumes pour amorcer la génération
const VEGETABLE_SUGGESTIONS = [
    'carrot', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'tomato', 
    'potato', 'onion', 'garlic', 'bell pepper', 'zucchini', 'eggplant'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
    'unit', 'gram', 'kilogram', 'piece', 'bunch', 'clove'
];

// Fonction pour générer le prompt système pour un légume
function generateSystemPrompt() {
    const fields = Ingredient.schema.paths;
    let prompt = `You are a vegetable and nutrition expert with access to:\n`;
    prompt += `- USDA Food Database\n- Agricultural Research Service\n- Nutritional Science Publications\n\n`;
    prompt += `Based on the vegetable name I give you, generate a JSON for this vegetable with:\n{\n`;

    for (const [key, value] of Object.entries(fields)) {
        if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
            prompt += `  "${key}": ${getExampleValue(value)},\n`;
        }
    }

    prompt += `}\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
    prompt += `2. Set frozenOrCanned to false as vegetables are usually fresh\n`;
    prompt += `3. Set storeShelf to 1 (produce section)\n`;
    prompt += `4. Include seasonal availability in seasons array (1-12 for months)\n`;
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
        frozenOrCanned: false, // Les légumes sont généralement frais
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année par défaut
        ignoreShoppingList: false,
        storeShelf: 1, // Rayon fruits et légumes
        quantity: 1,
        grossWeight: 100, // Portion standard de légume en grammes
        type: 'vegetable' // Définir le type comme légume
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

// Fonction pour obtenir des suggestions de légumes de l'IA
async function getSuggestedVegetables(baseVegetable, processedVegetables) {
    const aiProvider = getAIProvider('ollama');
    const existingVegetablesList = Array.from(processedVegetables).join(', ');
    
    const prompt = `You are a vegetable and agriculture expert. I need 5 new vegetable suggestions related to "${baseVegetable}".

IMPORTANT: DO NOT suggest any of these already existing vegetables: ${existingVegetablesList}

Return your response ONLY as a JSON array of 5 new vegetable names in English, like this example:
["vegetable1", "vegetable2", "vegetable3", "vegetable4", "vegetable5"]

Make sure your suggestions are:
1. Real edible vegetables
2. Different from the existing vegetables listed above
3. Common enough to be found in grocery stores
4. Single vegetables (not salads or processed products)
5. Specific varieties when possible (e.g. "roma tomato" instead of just "tomato")`;

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

async function generateSingleVegetable(vegetableName) {
    try {
        const aiProvider = getAIProvider('ollama');
        const systemPrompt = generateSystemPrompt();

        // Utiliser directement le nom en minuscules
        const normalizedName = vegetableName.toLowerCase();

        // Vérifier si le légume existe déjà
        let existingVegetable = await Ingredient.findOne({ name: normalizedName });
        if (existingVegetable) {
            console.log(`✓ Le légume "${vegetableName}" existe déjà`);
            return null;
        }

        // Générer les données du légume
        console.log(`⚡ Génération des données pour le légume "${vegetableName}"...`);
        try {
            const data = await aiProvider.generateCompletion(systemPrompt + `\nVegetable to analyze: ${normalizedName}`);
            console.log('Réponse reçue de l\'API');

            if (!('name' in data)) {
                throw new Error('Structure JSON invalide : nom manquant');
            }

            // Vérifier à nouveau après la génération
            existingVegetable = await Ingredient.findOne({ name: data.name.toLowerCase() });
            if (existingVegetable) {
                console.log(`✓ Le légume "${data.name}" a été généré mais existe déjà`);
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

            // Sauvegarder le nouveau légume
            const newVegetable = new Ingredient(lowerCaseData);
            await newVegetable.save();
            console.log(`✅ Légume "${data.name}" généré et sauvegardé avec succès`);
            return newVegetable;

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
        console.error(`❌ Erreur lors de la génération du légume "${vegetableName}":`, error.message);
        return null;
    }
}

async function generateVegetablesLoop() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.database.uri, config.database.options);
        console.log('✓ Connecté à MongoDB');

        // Commencer avec une liste vide
        let processedVegetables = new Set();
        console.log('📝 Démarrage avec une liste vide de légumes traités');

        let vegetablesToProcess = [...VEGETABLE_SUGGESTIONS];
        let currentIndex = 0;
        let successCount = 0;
        let failureCount = 0;
        let noNewSuggestionsCount = 0;

        while (true) {
            if (vegetablesToProcess.length === 0 || noNewSuggestionsCount > 5) {
                const baseVegetable = VEGETABLE_SUGGESTIONS[currentIndex % VEGETABLE_SUGGESTIONS.length];
                console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseVegetable}"...`);
                
                const newSuggestions = await getSuggestedVegetables(baseVegetable, processedVegetables);
                const filteredSuggestions = newSuggestions.filter(vegetable => !processedVegetables.has(vegetable));
                
                if (filteredSuggestions.length > 0) {
                    vegetablesToProcess.push(...filteredSuggestions);
                    noNewSuggestionsCount = 0;
                    console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de légumes ajoutées`);
                } else {
                    noNewSuggestionsCount++;
                    currentIndex++;
                    console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain légume de base (${noNewSuggestionsCount}/5)`);
                    continue;
                }
            }

            // Prendre le prochain légume de la file
            const currentVegetable = vegetablesToProcess.shift();
            
            if (processedVegetables.has(currentVegetable)) {
                continue;
            }

            processedVegetables.add(currentVegetable);
            
            const result = await generateSingleVegetable(currentVegetable);
            
            if (result) {
                successCount++;
                const newSuggestions = await getSuggestedVegetables(currentVegetable, processedVegetables);
                const filteredSuggestions = newSuggestions.filter(vegetable => !processedVegetables.has(vegetable));
                vegetablesToProcess.push(...filteredSuggestions);
            } else {
                failureCount++;
            }

            // Afficher les statistiques
            console.log('\n=== Statistiques ===');
            console.log(`Succès: ${successCount}`);
            console.log(`Échecs: ${failureCount}`);
            console.log(`Légumes en attente: ${vegetablesToProcess.length}`);
            console.log(`Légumes traités: ${processedVegetables.size}`);
            console.log('===================\n');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('Erreur globale:', error);
    }
}

// Lancer le script
console.log('🥕 Démarrage de la génération de légumes en boucle...');
generateVegetablesLoop(); 