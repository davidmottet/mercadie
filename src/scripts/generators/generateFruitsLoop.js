import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../../config/default.js';
import getAIProvider from '../../services/aiProvider.js';
import Ingredient from '../../models/ingredient.js';
import MeasurementUnit from '../../models/measurementUnit.js';

// Liste initiale de fruits pour amorcer la génération
const FRUIT_SUGGESTIONS = [
  'apple', 'banana', 'orange', 'strawberry', 'grape', 'pineapple',
  'mango', 'peach', 'pear', 'kiwi', 'watermelon', 'blueberry'
];

// Liste des unités de mesure valides
const VALID_MEASUREMENT_UNITS = [
  'unit', 'gram', 'kilogram', 'piece', 'slice', 'bunch'
];

// Fonction pour générer le prompt système pour un fruit
function generateSystemPrompt () {
  const fields = Ingredient.schema.paths;
  let prompt = `You are a fruit and nutrition expert with access to:\n`;
  prompt += `- USDA Food Database\n- FAO Fruit Database\n- Nutritional Science Publications\n\n`;
  prompt += `Based on the fruit name I give you, generate a JSON for this fruit with:\n{\n`;

  for (const [key, value] of Object.entries(fields)) {
    if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
      prompt += `  "${key}": ${getExampleValue(value)},\n`;
    }
  }

  prompt += `}\n\n`;
  prompt += `IMPORTANT:\n`;
  prompt += `1. For measurementUnit field, use ONLY: ${VALID_MEASUREMENT_UNITS.join(', ')}\n`;
  prompt += `2. Set frozenOrCanned to false as fruits are usually fresh\n`;
  prompt += `3. Set storeShelf to 1 (produce section)\n`;
  prompt += `4. Include seasonal availability in seasons array (1-12 for months)\n`;
  prompt += `5. Set appropriate grossWeight based on typical portion size\n`;

  return prompt;
}

function getExampleValue (field) {
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
function validateAndCompleteData (data) {
  const defaultValues = {
    frozenOrCanned: false, // Les fruits sont généralement frais
    seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Disponible toute l'année par défaut
    ignoreShoppingList: false,
    storeShelf: 1, // Rayon fruits et légumes
    quantity: 1,
    grossWeight: 100, // Portion standard de fruit en grammes
    type: 'fruit' // Définir le type comme fruit
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

// Fonction pour obtenir des suggestions de fruits de l'IA
async function getSuggestedFruits (baseFruit, processedFruits) {
  const aiProvider = getAIProvider('ollama');
  const existingFruitsList = Array.from(processedFruits).join(', ');

  const prompt = `You are a fruit and botany expert. I need 5 new fruit suggestions related to "${baseFruit}".

IMPORTANT: DO NOT suggest any of these already existing fruits: ${existingFruitsList}

Return your response ONLY as a JSON array of 5 new fruit names in English, like this example:
["fruit1", "fruit2", "fruit3", "fruit4", "fruit5"]

Make sure your suggestions are:
1. Real edible fruits
2. Different from the existing fruits listed above
3. Common enough to be found in grocery stores
4. Single fruits (not fruit salads or processed products)
5. Specific varieties when possible (e.g. "golden delicious apple" instead of just "apple")`;

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
        } catch {
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

async function generateSingleFruit (fruitName) {
  try {
    const aiProvider = getAIProvider('ollama');
    const systemPrompt = generateSystemPrompt();

    // Utiliser directement le nom en minuscules
    const normalizedName = fruitName.toLowerCase();

    // Vérifier si le fruit existe déjà
    let existingFruit = await Ingredient.findOne({ name: normalizedName });
    if (existingFruit) {
      console.log(`✓ Le fruit "${fruitName}" existe déjà`);
      return null;
    }

    // Générer les données du fruit
    console.log(`⚡ Génération des données pour le fruit "${fruitName}"...`);
    try {
      const data = await aiProvider.generateCompletion(systemPrompt + `\nFruit to analyze: ${normalizedName}`);
      console.log('Réponse reçue de l\'API');

      if (!('name' in data)) {
        throw new Error('Structure JSON invalide : nom manquant');
      }

      // Vérifier à nouveau après la génération
      existingFruit = await Ingredient.findOne({ name: data.name.toLowerCase() });
      if (existingFruit) {
        console.log(`✓ Le fruit "${data.name}" a été généré mais existe déjà`);
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

      // Sauvegarder le nouveau fruit
      const newFruit = new Ingredient(lowerCaseData);
      await newFruit.save();
      console.log(`✅ Fruit "${data.name}" généré et sauvegardé avec succès`);
      return newFruit;

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
        } catch {
          console.error('- Impossible de lire le corps de la réponse');
        }
      }
      throw fetchError; // Relancer l'erreur pour la gestion plus haut
    }

  } catch (error) {
    console.error(`❌ Erreur lors de la génération du fruit "${fruitName}":`, error.message);
    return null;
  }
}

async function generateFruitsLoop () {
  try {
    // Connexion à MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('✓ Connecté à MongoDB');

    // Commencer avec une liste vide
    let processedFruits = new Set();
    console.log('📝 Démarrage avec une liste vide de fruits traités');

    let fruitsToProcess = [...FRUIT_SUGGESTIONS];
    let currentIndex = 0;
    let successCount = 0;
    let failureCount = 0;
    let noNewSuggestionsCount = 0;

    while (true) {
      if (fruitsToProcess.length === 0 || noNewSuggestionsCount > 5) {
        const baseFruit = FRUIT_SUGGESTIONS[currentIndex % FRUIT_SUGGESTIONS.length];
        console.log(`\n🔄 Génération de nouvelles suggestions à partir de "${baseFruit}"...`);

        const newSuggestions = await getSuggestedFruits(baseFruit, processedFruits);
        const filteredSuggestions = newSuggestions.filter(fruit => !processedFruits.has(fruit));

        if (filteredSuggestions.length > 0) {
          fruitsToProcess.push(...filteredSuggestions);
          noNewSuggestionsCount = 0;
          console.log(`✨ ${filteredSuggestions.length} nouvelles suggestions de fruits ajoutées`);
        } else {
          noNewSuggestionsCount++;
          currentIndex++;
          console.log(`⚠️ Aucune nouvelle suggestion valide, passage au prochain fruit de base (${noNewSuggestionsCount}/5)`);
          continue;
        }
      }

      // Prendre le prochain fruit de la file
      const currentFruit = fruitsToProcess.shift();

      if (processedFruits.has(currentFruit)) {
        continue;
      }

      processedFruits.add(currentFruit);

      const result = await generateSingleFruit(currentFruit);

      if (result) {
        successCount++;
        const newSuggestions = await getSuggestedFruits(currentFruit, processedFruits);
        const filteredSuggestions = newSuggestions.filter(fruit => !processedFruits.has(fruit));
        fruitsToProcess.push(...filteredSuggestions);
      } else {
        failureCount++;
      }

      // Afficher les statistiques
      console.log('\n=== Statistiques ===');
      console.log(`Succès: ${successCount}`);
      console.log(`Échecs: ${failureCount}`);
      console.log(`Fruits en attente: ${fruitsToProcess.length}`);
      console.log(`Fruits traités: ${processedFruits.size}`);
      console.log('===================\n');

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

  } catch (error) {
    console.error('Erreur globale:', error);
  }
}

// Lancer le script
console.log('🍎 Démarrage de la génération de fruits en boucle...');
generateFruitsLoop();