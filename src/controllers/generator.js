import OpenAI from 'openai';
import { translate } from '@vitalets/google-translate-api';
import config from '../../config/default.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

const openai = new OpenAI({
  apiKey: config.ia.openAi.key
});

// Fonction pour générer dynamiquement le SYSTEM_PROMPT
function generateSystemPrompt () {
  const fields = Ingredient.schema.paths;
  let prompt = `NutriGen, nutrition expert. Access:\n`;
  prompt += `- Ciqual 2024\n- ANSES\n- USDA\n- Recent publications\n\n`;
  prompt += `Generate a JSON for an ingredient with:\n{\n`;

  for (const [key, value] of Object.entries(fields)) {
    if (key !== '__v' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
      prompt += `  "${key}": ${getExampleValue(value)},\n`;
    }
  }

  prompt += `}`;

  return prompt;
}

// Fonction pour obtenir une valeur d'exemple en fonction du type de champ
function getExampleValue (field) {
  switch (field.instance) {
		case 'String':
			return `"Exemple de texte"`;
		case 'Number':
			return 0;
		case 'Boolean':
			return false;
		case 'Array':
			return field.caster.instance === 'Number' ? '[0, 1, 2]' : '[]';
		case 'ObjectID':
			return 'null'; // ou un ID d'exemple si nécessaire
		default:
			return 'null';
  }
}

const SYSTEM_PROMPT = generateSystemPrompt();

export const generateIngredients = async (req, res) => {
  const { ingredients } = req.body;
  try {

    res.json({response: ingredients})

  } catch (error) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

async function checkIngredientExistence(name) {
  return await Ingredient.findOne({ name: name.toLowerCase() });
}

export const generateIngredient = async (req, res) => {
  const { ingredient } = req.body;
  try {
    const translation = await translate(ingredient, { to: 'en' });
    const translatedIngredient = translation.text.toLowerCase();

    let existingIngredient = await checkIngredientExistence(translatedIngredient);
    if (existingIngredient) {
      console.log('existingIngredient', translatedIngredient);
      return res.json({
        ...existingIngredient.toObject(),
        sources: ["Ciqual 2024", "USDA", "ANSES"],
        date_generation: new Date().toISOString()
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a full profile for ${translatedIngredient}, translate to English, and return it.` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const data = JSON.parse(completion.choices[0].message.content);

    if (!('name' in data) || !('quantity' in data)) {
      throw new Error('Structure JSON invalide');
    }

    existingIngredient = await checkIngredientExistence(data.name);
    if (existingIngredient) {
      console.log('existingIngredient after AI generation', data.name.toLowerCase());
      return res.json({
        ...existingIngredient.toObject(),
        sources: ["Ciqual 2024", "USDA", "ANSES"],
        date_generation: new Date().toISOString()
      });
    }

    let measurementUnitDoc = await MeasurementUnit.findOne({ name: data.measurementUnit });
    if (!measurementUnitDoc) {
      measurementUnitDoc = new MeasurementUnit({ name: data.measurementUnit });
      await measurementUnitDoc.save();
    }
    data.measurementUnit = measurementUnitDoc._id;

    const newIngredient = new Ingredient(data);
    await newIngredient.save();

    res.json({
      ...newIngredient.toObject(),
      sources: ["Ciqual 2024", "USDA", "ANSES"],
      date_generation: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};