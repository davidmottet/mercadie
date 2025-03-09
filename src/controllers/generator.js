import { translate } from '@vitalets/google-translate-api';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
import MeasurementUnit from '../models/measurementUnit.js';

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
    return `"String"`;
  case 'Number':
    return 0;
  case 'Boolean':
    return false;
  case 'Array':
    return field.caster.instance === 'Number' ? '[0, 1, 2]' : '[]';
  case 'ObjectID':
    return 'null';
  default:
    return 'null';
  }
}

const SYSTEM_PROMPT = generateSystemPrompt();

export const generateIngredients = async (req, res) => {
  const { ingredients } = req.body;

  if (!ingredients || !Array.isArray(ingredients)) {
    const error = new Error('Liste d\'ingrédients invalide');
    error.statusCode = 400;
    throw error;
  }

  res.json({ response: ingredients });
};

async function checkIngredientExistence (name) {
  return await Ingredient.findOne({ name: name.toLowerCase() });
}

export const generateIngredient = async (req, res) => {
  const { ingredient } = req.body;

  if (!ingredient) {
    const error = new Error('Nom d\'ingrédient requis');
    error.statusCode = 400;
    throw error;
  }

  const aiProvider = getAIProvider('ollama');

  const translation = await translate(ingredient, { to: 'en' });
  const translatedIngredient = translation.text.toLowerCase();

  let existingIngredient = await checkIngredientExistence(translatedIngredient);
  if (existingIngredient) {
    return res.json({
      ...existingIngredient.toObject(),
      sources: ["Ciqual 2024", "USDA", "ANSES"],
      date_generation: new Date().toISOString()
    });
  }

  const data = await aiProvider.generateCompletion(SYSTEM_PROMPT);

  if (!('name' in data) || !('quantity' in data)) {
    const error = new Error('Structure JSON invalide retournée par l\'IA');
    error.statusCode = 422;
    throw error;
  }

  existingIngredient = await checkIngredientExistence(data.name);
  if (existingIngredient) {
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

  const lowerCaseData = {};
  for (const key in data) {
    if (typeof data[key] === 'string') {
      lowerCaseData[key] = data[key].toLowerCase();
    } else {
      lowerCaseData[key] = data[key];
    }
  }

  const newIngredient = new Ingredient(lowerCaseData);
  await newIngredient.save();

  res.json({
    ...newIngredient.toObject(),
    sources: ["Ciqual 2024", "USDA", "ANSES"],
    date_generation: new Date().toISOString()
  });
};