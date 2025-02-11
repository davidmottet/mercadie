import OpenAI from 'openai';
import config from '../../config/default.js';
import Ingredient from '../models/ingredient.js';

const openai = new OpenAI({
  apiKey: config.ia.openAi.key
});

// Fonction pour générer dynamiquement le SYSTEM_PROMPT
function generateSystemPrompt () {
  const fields = Ingredient.schema.paths;
  let prompt = `Tu es NutriGen, un expert en nutrition avec accès à :\n`;
  prompt += `- La base Ciqual 2024\n- Les dernières études de l'ANSES\n- La base de données USDA\n- Les publications scientifiques récentes\n\n`;
  prompt += `Génère un JSON valide pour un ingrédient avec ces champs :\n{\n`;

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Génère une fiche complète pour : ${ingredients}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const data = JSON.parse(completion.choices[0].message.content);

    if (!data.name || !data.quantity) {
      throw new Error('Structure JSON invalide');
    }

    res.json({
      ...data,
      sources: ["Ciqual 2024", "USDA", "ANSES"],
      date_generation: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

export const generateIngredient = async (req, res) => {
  const { ingredient } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Génère une fiche complète pour : ${ingredient}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const data = JSON.parse(completion.choices[0].message.content);

    if (!data.name || !data.quantity) {
      throw new Error('Structure JSON invalide');
    }

    res.json({
      ...data,
      sources: ["Ciqual 2024", "USDA", "ANSES"],
      date_generation: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};