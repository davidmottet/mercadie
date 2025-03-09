import 'dotenv/config';
import process from 'process';
import mongoose from 'mongoose';
import config from '../../../config/default.js';
import getAIProvider from '../../services/aiProvider.js';
import Ingredient from '../../models/ingredient.js';
import fs from 'fs';
import path from 'path';

// Définition des saisons
const SEASONS = {
  SUMMER: [6, 7, 8],       // Juin, Juillet, Août
  AUTUMN: [9, 10, 11],     // Septembre, Octobre, Novembre
  WINTER: [12, 1, 2],      // Décembre, Janvier, Février
  SPRING: [3, 4, 5]        // Mars, Avril, Mai
};

// Règles de validation par type d'ingrédient
const TYPE_VALIDATION_RULES = {
  'meat': {
    frozenOrCanned: true,
    storeShelf: 2,
    checkPork: true
  },
  'fish': {
    frozenOrCanned: true,
    storeShelf: 2
  },
  'vegetable': {
    frozenOrCanned: false,
    storeShelf: 1,
    checkSeasons: true
  },
  'fruit': {
    frozenOrCanned: false,
    storeShelf: 1,
    checkSeasons: true
  },
  'dairy': {
    frozenOrCanned: true,
    storeShelf: 3
  },
  'grain': {
    frozenOrCanned: false,
    storeShelf: 4
  },
  'spice': {
    frozenOrCanned: false,
    storeShelf: 5
  },
  'beverage': {
    frozenOrCanned: false,
    storeShelf: 6
  },
  'condiment': {
    frozenOrCanned: false,
    storeShelf: 5
  }
};

// Ingrédients communs qui devraient avoir ignoreShoppingList = true
const COMMON_INGREDIENTS = [
  'salt', 'pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'water',
  'garlic', 'onion', 'butter', 'milk', 'eggs', 'rice', 'pasta', 'bread'
];

// Mots-clés pour détecter les types d'ingrédients
const TYPE_KEYWORDS = {
  'meat': ['beef', 'chicken', 'pork', 'lamb', 'turkey', 'duck', 'veal', 'venison', 'rabbit', 'goat', 'bison', 'ham', 'steak', 'sausage', 'bacon', 'meat'],
  'fish': ['fish', 'salmon', 'tuna', 'cod', 'trout', 'bass', 'tilapia', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'octopus', 'anchovy', 'sardine', 'mackerel', 'herring'],
  'vegetable': ['vegetable', 'carrot', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'tomato', 'potato', 'onion', 'garlic', 'pepper', 'zucchini', 'eggplant', 'cabbage', 'cauliflower', 'celery', 'asparagus', 'leek', 'pea', 'bean', 'lentil'],
  'fruit': ['fruit', 'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'pineapple', 'mango', 'peach', 'pear', 'plum', 'cherry', 'kiwi', 'watermelon', 'melon', 'lemon', 'lime', 'grapefruit'],
  'dairy': ['dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'curd', 'whey', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'brie', 'gouda'],
  'grain': ['grain', 'rice', 'wheat', 'oat', 'barley', 'corn', 'quinoa', 'millet', 'buckwheat', 'rye', 'bulgur', 'couscous', 'pasta', 'noodle', 'bread', 'flour', 'cereal'],
  'spice': ['spice', 'herb', 'pepper', 'salt', 'cinnamon', 'nutmeg', 'clove', 'cardamom', 'cumin', 'coriander', 'turmeric', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'sage', 'mint', 'bay leaf', 'vanilla', 'saffron'],
  'beverage': ['beverage', 'drink', 'water', 'juice', 'soda', 'tea', 'coffee', 'milk', 'wine', 'beer', 'cocktail', 'smoothie', 'shake', 'lemonade'],
  'condiment': ['condiment', 'sauce', 'ketchup', 'mustard', 'mayonnaise', 'vinegar', 'oil', 'dressing', 'salsa', 'pesto', 'hummus', 'guacamole', 'jam', 'jelly', 'honey', 'syrup', 'sugar']
};

// Fonction pour générer le prompt système pour l'IA
function generateSystemPrompt (ingredient) {
  // Extraire uniquement les champs essentiels pour l'analyse
  const simplifiedIngredient = {
    _id: ingredient._id,
    name: ingredient.name,
    type: ingredient.type || 'other',
    frozenOrCanned: ingredient.frozenOrCanned || false,
    storeShelf: ingredient.storeShelf || 0,
    withPork: ingredient.withPork || false,
    ignoreShoppingList: ingredient.ignoreShoppingList || false,
    seasons: ingredient.seasons || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  };

  return `Tu es un expert en nutrition et en alimentation. Analyse cet ingrédient et vérifie sa cohérence:

${JSON.stringify(simplifiedIngredient, null, 2)}

Réponds UNIQUEMENT avec un objet JSON contenant:
1. Un champ "type" avec le type correct de l'ingrédient
2. Un champ "frozenOrCanned" (boolean)
3. Un champ "storeShelf" (nombre entier)
4. Un champ "withPork" (boolean) si pertinent
5. Un champ "ignoreShoppingList" (boolean)
6. Un champ "seasons" (tableau de nombres représentant les mois de disponibilité) si c'est un fruit ou légume
7. Un champ "changes" (tableau de chaînes) listant les modifications apportées
8. Un champ "explanation" (chaîne) expliquant pourquoi ces changements sont nécessaires

Voici les règles à respecter:
- Le type doit être l'un des suivants: meat, fish, vegetable, fruit, dairy, grain, spice, beverage, condiment, other
- Pour les viandes: frozenOrCanned=true, storeShelf=2, withPork=true si c'est du porc
- Pour les poissons: frozenOrCanned=true, storeShelf=2
- Pour les fruits et légumes: frozenOrCanned=false, storeShelf=1, seasons doit être cohérent (pas toute l'année)
- Pour les produits laitiers: frozenOrCanned=true, storeShelf=3
- Pour les céréales: frozenOrCanned=false, storeShelf=4
- Pour les épices: frozenOrCanned=false, storeShelf=5
- Pour les boissons: frozenOrCanned=false, storeShelf=6
- Pour les condiments: frozenOrCanned=false, storeShelf=5
- Les ingrédients communs (sel, poivre, huile, etc.) doivent avoir ignoreShoppingList=true

IMPORTANT pour le champ "seasons":
- Ce champ doit contenir UNIQUEMENT les numéros des mois où l'ingrédient est disponible (1=janvier, 2=février, etc.)
- Exemples:
  * Pommes (automne): [9, 10, 11] (septembre, octobre, novembre)
  * Fraises (printemps): [3, 4, 5] (mars, avril, mai)
  * Tomates (été): [6, 7, 8] (juin, juillet, août)
  * Carottes (automne et hiver): [9, 10, 11, 12, 1, 2] (septembre à février)
  * Ingrédients disponibles toute l'année: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

IMPORTANT pour le champ "changes":
- Ce champ doit être un tableau de chaînes de caractères
- Chaque chaîne doit décrire une modification au format "champ: ancienne valeur -> nouvelle valeur"
- Exemple: ["type: 'other' -> 'fruit'", "storeShelf: 0 -> 1", "seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] -> [9, 10, 11]"]

Réponds UNIQUEMENT avec un objet JSON valide contenant SEULEMENT les champs mentionnés ci-dessus.`;
}

// Fonction pour exporter les résultats dans un fichier CSV
function exportToCSV (results, stats) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `ingredient-ai-analysis-${timestamp}.csv`;
  const filepath = path.join(process.cwd(), filename);

  // Créer l'en-tête du CSV
  let csvContent = 'ID,Name,Type,Changes,Explanation,Analysis Method\n';

  // Ajouter les données
  results.forEach(result => {
    const changes = result.changes.join(' | ').replace(/,/g, ';'); // Remplacer les virgules pour éviter de casser le CSV
    const explanation = result.explanation.replace(/,/g, ';').replace(/\n/g, ' '); // Nettoyer l'explication
    csvContent += `${result.id},${result.name},${result.type},"${changes}","${explanation}","${result.analysisMethod}"\n`;
  });

  // Ajouter les statistiques
  csvContent += '\nStatistics\n';
  csvContent += `Total ingredients,${stats.total}\n`;
  csvContent += `Ingredients analyzed,${stats.analyzed}\n`;
  csvContent += `Ingredients updated,${stats.updated}\n`;
  csvContent += `Failed ingredients,${stats.failed}\n`;
  csvContent += `AI analysis,${stats.aiAnalysis}\n`;
  csvContent += `Procedural analysis,${stats.proceduralAnalysis}\n`;

  csvContent += '\nDistribution by type\n';
  Object.entries(stats.byType).forEach(([type, count]) => {
    csvContent += `${type},${count},${Math.round(count/stats.total*100)}%\n`;
  });

  csvContent += '\nCommon changes\n';
  Object.entries(stats.commonChanges)
    .sort((a, b) => b[1] - a[1])
    .forEach(([change, count]) => {
      csvContent += `${change},${count}\n`;
    });

  // Écrire le fichier
  fs.writeFileSync(filepath, csvContent);
  console.log(`\n📊 Résultats exportés dans ${filename}`);

  return filepath;
}

// Fonction pour détecter le type d'ingrédient en fonction de son nom
function detectIngredientType (name) {
  name = name.toLowerCase();

  // Vérifier chaque type de mots-clés
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return type;
      }
    }
  }

  // Si aucun type n'est détecté, retourner 'other'
  return 'other';
}

// Fonction pour vérifier si un ingrédient est commun
function isCommonIngredient (name) {
  name = name.toLowerCase();
  return COMMON_INGREDIENTS.some(common => name.includes(common));
}

// Fonction pour vérifier si un ingrédient contient du porc
function containsPork (name) {
  name = name.toLowerCase();
  const porkKeywords = ['pork', 'ham', 'bacon', 'sausage', 'prosciutto', 'pancetta', 'lard', 'chorizo'];
  return porkKeywords.some(keyword => name.includes(keyword));
}

// Fonction pour suggérer des saisons appropriées pour un ingrédient
function suggestSeasons (type, name) {
  name = name.toLowerCase();
  // Par défaut, disponible toute l'année
  const allYear = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Pour les fruits et légumes, suggérer des saisons plus spécifiques
  if (type === 'fruit') {
    // Exemples de fruits d'été
    if (name.includes('berry') || name.includes('melon') || name.includes('peach') ||
        name.includes('cherry') || name.includes('apricot')) {
      return SEASONS.SUMMER;
    }
    // Exemples de fruits d'automne
    else if (name.includes('apple') || name.includes('pear') || name.includes('grape') ||
             name.includes('fig') || name.includes('plum')) {
      return SEASONS.AUTUMN;
    }
    // Exemples de fruits d'hiver
    else if (name.includes('orange') || name.includes('grapefruit') ||
             name.includes('clementine') || name.includes('kiwi')) {
      return SEASONS.WINTER;
    }
    // Exemples de fruits de printemps
    else if (name.includes('strawberry') || name.includes('rhubarb')) {
      return SEASONS.SPRING;
    }
  }
  else if (type === 'vegetable') {
    // Exemples de légumes d'été
    if (name.includes('tomato') || name.includes('cucumber') || name.includes('zucchini') ||
        name.includes('eggplant') || name.includes('pepper')) {
      return SEASONS.SUMMER;
    }
    // Exemples de légumes d'automne
    else if (name.includes('pumpkin') || name.includes('squash') || name.includes('mushroom') ||
             name.includes('brussels') || name.includes('cabbage')) {
      return SEASONS.AUTUMN;
    }
    // Exemples de légumes d'hiver
    else if (name.includes('potato') || name.includes('carrot') || name.includes('turnip') ||
             name.includes('leek') || name.includes('onion')) {
      return [...SEASONS.AUTUMN, ...SEASONS.WINTER]; // Disponible en automne et hiver
    }
    // Exemples de légumes de printemps
    else if (name.includes('asparagus') || name.includes('pea') || name.includes('spinach') ||
             name.includes('lettuce') || name.includes('radish')) {
      return SEASONS.SPRING;
    }
  }

  // Par défaut, retourner toute l'année
  return allYear;
}

// Fonction pour valider et corriger un ingrédient de manière procédurale
function validateAndCorrectIngredient (ingredient) {
  const name = ingredient.name.toLowerCase();
  const changes = [];
  const updatedData = { ...ingredient.toObject() };
  let explanation = '';

  // 1. Valider et corriger le type
  const currentType = ingredient.type || 'other';
  const detectedType = detectIngredientType(name);

  if (currentType === 'other' && detectedType !== 'other') {
    updatedData.type = detectedType;
    changes.push(`Type: 'other' -> '${detectedType}'`);
    explanation += `Le type a été changé de 'other' à '${detectedType}' car le nom contient des mots-clés associés à ce type. `;
  }

  // Utiliser le type détecté ou le type actuel pour les validations suivantes
  const typeToUse = updatedData.type;
  const rules = TYPE_VALIDATION_RULES[typeToUse];

  // 2. Valider et corriger frozenOrCanned
  if (rules && rules.frozenOrCanned !== undefined && ingredient.frozenOrCanned !== rules.frozenOrCanned) {
    updatedData.frozenOrCanned = rules.frozenOrCanned;
    changes.push(`frozenOrCanned: ${ingredient.frozenOrCanned} -> ${rules.frozenOrCanned}`);
    explanation += `frozenOrCanned a été mis à ${rules.frozenOrCanned} car c'est la valeur recommandée pour les ${typeToUse}s. `;
  }

  // 3. Valider et corriger storeShelf
  if (rules && rules.storeShelf !== undefined && ingredient.storeShelf !== rules.storeShelf) {
    updatedData.storeShelf = rules.storeShelf;
    changes.push(`storeShelf: ${ingredient.storeShelf} -> ${rules.storeShelf}`);
    explanation += `storeShelf a été mis à ${rules.storeShelf} car c'est la valeur recommandée pour les ${typeToUse}s. `;
  }

  // 4. Valider et corriger withPork
  if ((rules && rules.checkPork) || typeToUse === 'meat') {
    if (containsPork(name) && !ingredient.withPork) {
      updatedData.withPork = true;
      changes.push(`withPork: false -> true`);
      explanation += `withPork a été mis à true car le nom indique qu'il s'agit d'un produit à base de porc. `;
    }
  }

  // 5. Valider et corriger ignoreShoppingList
  if (isCommonIngredient(name) && !ingredient.ignoreShoppingList) {
    updatedData.ignoreShoppingList = true;
    changes.push(`ignoreShoppingList: false -> true`);
    explanation += `ignoreShoppingList a été mis à true car c'est un ingrédient commun généralement disponible dans les cuisines. `;
  }

  // 6. Valider et corriger les saisons pour les fruits et légumes
  if ((typeToUse === 'fruit' || typeToUse === 'vegetable') && rules && rules.checkSeasons) {
    const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const currentSeasons = ingredient.seasons || allMonths;
    const isAllYear = currentSeasons.length === 12 && allMonths.every(month => currentSeasons.includes(month));

    if (isAllYear) {
      const suggestedSeasonMonths = suggestSeasons(typeToUse, name);
      if (suggestedSeasonMonths.length < 12) {
        updatedData.seasons = suggestedSeasonMonths;
        changes.push(`seasons: [toute l'année] -> [saisons spécifiques]`);
        explanation += `Les saisons ont été ajustées car les ${typeToUse}s ne sont généralement pas disponibles toute l'année. `;
      }
    }
  }

  // Vérifier s'il y a des changements
  const hasChanges = changes.length > 0;

  return {
    id: ingredient._id,
    name: ingredient.name,
    type: typeToUse,
    originalType: ingredient.type,
    changes: changes,
    explanation: explanation,
    updatedData: hasChanges ? updatedData : null,
    hasChanges: hasChanges,
    analysisMethod: 'procedural'
  };
}

// Fonction pour analyser un ingrédient avec l'IA
async function analyzeIngredientWithAI (ingredient, aiProvider, maxRetries = 5, verbose = false) {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      if (retryCount > 0) {
        console.log(`🔄 Tentative ${retryCount + 1}/${maxRetries} pour "${ingredient.name}" (${ingredient._id})...`);
        // Attendre un peu plus longtemps entre les tentatives
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      } else {
        console.log(`🔍 Analyse IA de l'ingrédient "${ingredient.name}" (${ingredient._id})...`);
      }

      // Générer le prompt pour l'IA
      const prompt = generateSystemPrompt(ingredient.toObject());

      // Obtenir l'analyse de l'IA
      const analysis = await aiProvider.generateCompletion(prompt);

      // Afficher la réponse brute de l'IA pour le débogage (uniquement en mode verbose)
      if (verbose) {
        console.log(`\n📝 Réponse brute de l'IA pour "${ingredient.name}":`);
        console.log(JSON.stringify(analysis, null, 2));
      }

      // Vérifier que l'analyse est valide
      if (!analysis) {
        throw new Error('Analyse invalide: réponse vide');
      }

      // S'assurer que changes est un tableau
      if (!analysis.changes) {
        if (verbose) console.log(`⚠️ Champ 'changes' manquant dans la réponse pour "${ingredient.name}"`);
        analysis.changes = [];
      } else if (!Array.isArray(analysis.changes)) {
        if (verbose) console.log(`⚠️ Le champ 'changes' n'est pas un tableau pour "${ingredient.name}". Type: ${typeof analysis.changes}`);
        // Si changes n'est pas un tableau, essayer de le convertir en tableau
        if (typeof analysis.changes === 'string') {
          analysis.changes = [analysis.changes];
          if (verbose) console.log(`✓ Converti 'changes' en tableau: ${JSON.stringify(analysis.changes)}`);
        } else {
          if (verbose) console.warn(`⚠️ Format inattendu pour changes: ${typeof analysis.changes}`);
          analysis.changes = [];
        }
      }

      // Créer un objet avec les modifications à appliquer
      const updatedData = {};
      const originalData = ingredient.toObject();
      const changes = [];

      // Vérifier et ajouter chaque champ modifié
      if (analysis.type && analysis.type !== originalData.type) {
        updatedData.type = analysis.type;
        changes.push(`Type: '${originalData.type || 'other'}' -> '${analysis.type}'`);
      }

      if (analysis.frozenOrCanned !== undefined && analysis.frozenOrCanned !== originalData.frozenOrCanned) {
        updatedData.frozenOrCanned = analysis.frozenOrCanned;
        changes.push(`frozenOrCanned: ${originalData.frozenOrCanned} -> ${analysis.frozenOrCanned}`);
      }

      if (analysis.storeShelf !== undefined && analysis.storeShelf !== originalData.storeShelf) {
        updatedData.storeShelf = analysis.storeShelf;
        changes.push(`storeShelf: ${originalData.storeShelf} -> ${analysis.storeShelf}`);
      }

      if (analysis.withPork !== undefined && analysis.withPork !== originalData.withPork) {
        updatedData.withPork = analysis.withPork;
        changes.push(`withPork: ${originalData.withPork} -> ${analysis.withPork}`);
      }

      if (analysis.ignoreShoppingList !== undefined && analysis.ignoreShoppingList !== originalData.ignoreShoppingList) {
        updatedData.ignoreShoppingList = analysis.ignoreShoppingList;
        changes.push(`ignoreShoppingList: ${originalData.ignoreShoppingList} -> ${analysis.ignoreShoppingList}`);
      }

      if (analysis.seasons && Array.isArray(analysis.seasons)) {
        // Vérifier si les saisons sont différentes
        const originalSeasons = originalData.seasons || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const seasonsChanged = !arraysEqual(analysis.seasons, originalSeasons);

        if (seasonsChanged) {
          updatedData.seasons = analysis.seasons;
          changes.push(`seasons: [${originalSeasons.join(', ')}] -> [${analysis.seasons.join(', ')}]`);
        }
      }

      // Si l'IA a fourni ses propres changements, les ajouter
      if (analysis.changes && analysis.changes.length > 0) {
        if (verbose) console.log(`✓ Traitement des changements fournis par l'IA: ${JSON.stringify(analysis.changes)}`);

        // Filtrer les changements qui ne sont pas déjà inclus
        const aiChanges = analysis.changes
          .filter(change => {
            if (typeof change !== 'string') {
              if (verbose) console.warn(`⚠️ Changement non-string ignoré: ${JSON.stringify(change)} (type: ${typeof change})`);
              return false;
            }
            return true;
          })
          .filter(change => {
            try {
              const changeType = change.split(':')[0].trim();
              const isIncluded = !changes.some(c => c.includes(changeType));
              if (!isIncluded && verbose) {
                console.log(`ℹ️ Changement déjà inclus, ignoré: ${change}`);
              }
              return isIncluded;
            } catch (e) {
              if (verbose) console.warn(`⚠️ Impossible de traiter le changement: ${change}. Erreur: ${e.message}`);
              return false;
            }
          });

        if (verbose) console.log(`✓ Changements filtrés à ajouter: ${JSON.stringify(aiChanges)}`);
        changes.push(...aiChanges);
      }

      // Vérifier si des modifications sont nécessaires
      const hasChanges = Object.keys(updatedData).length > 0 || changes.length > 0;

      return {
        id: ingredient._id,
        name: ingredient.name,
        type: analysis.type || ingredient.type,
        originalType: ingredient.type,
        changes: changes,
        explanation: analysis.explanation || '',
        updatedData: hasChanges ? updatedData : null,
        hasChanges: hasChanges,
        analysisMethod: 'ai'
      };

    } catch (error) {
      console.error(`❌ Erreur lors de l'analyse IA de "${ingredient.name}" (tentative ${retryCount + 1}/${maxRetries}):`, error.message);
      if (verbose) console.error(`   Stack trace: ${error.stack}`);
      retryCount++;

      // Si c'est la dernière tentative, on abandonne l'IA mais on ne retourne pas null
      if (retryCount >= maxRetries) {
        console.error(`⛔ Abandon de l'analyse IA pour "${ingredient.name}" après ${maxRetries} tentatives.`);
        console.log(`🔄 Basculement vers l'analyse procédurale pour "${ingredient.name}"...`);
        return null;
      }
    }
  }

  return null;
}

// Fonction utilitaire pour comparer deux tableaux
function arraysEqual (a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // Trier les tableaux pour une comparaison indépendante de l'ordre
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);

  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

// Fonction principale pour analyser la base de données
async function analyzeDatabase () {
  // Vérifier les arguments
  const shouldFix = process.argv.includes('--fix');
  const shouldExport = process.argv.includes('--export');
  const limit = process.argv.includes('--limit')
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
    : 0;
  const maxRetries = process.argv.includes('--max-retries')
    ? parseInt(process.argv[process.argv.indexOf('--max-retries') + 1])
    : 5;
  const forceProceduralOnly = process.argv.includes('--procedural-only');
  const verbose = process.argv.includes('--verbose');

  // Option pour reprendre à partir d'un ingrédient spécifique
  const startFromIndex = process.argv.indexOf('--start-from');
  const startFromName = startFromIndex !== -1 ? process.argv[startFromIndex + 1] : null;

  // Option pour définir le nombre maximum de timeouts consécutifs avant d'arrêter
  const maxConsecutiveTimeoutsIndex = process.argv.indexOf('--max-consecutive-timeouts');
  const maxConsecutiveTimeouts = maxConsecutiveTimeoutsIndex !== -1
    ? parseInt(process.argv[maxConsecutiveTimeoutsIndex + 1])
    : 3; // Par défaut, arrêt après 3 timeouts consécutifs

  try {
    // Connexion à MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('✓ Connecté à MongoDB');

    // Initialiser le fournisseur d'IA si on n'est pas en mode procédural uniquement
    let aiProvider = null;
    if (!forceProceduralOnly) {
      aiProvider = getAIProvider('ollama');
      console.log('✓ Fournisseur d\'IA initialisé');
    }

    // Récupérer tous les ingrédients
    let query = Ingredient.find({});

    // Si on doit commencer à partir d'un ingrédient spécifique
    if (startFromName) {
      console.log(`🔍 Recherche de l'ingrédient "${startFromName}" pour reprendre l'analyse...`);
      const startIngredient = await Ingredient.findOne({ name: new RegExp(startFromName, 'i') });

      if (startIngredient) {
        console.log(`✓ Ingrédient "${startIngredient.name}" trouvé. Reprise de l'analyse à partir de cet ingrédient.`);
        query = Ingredient.find({ _id: { $gte: startIngredient._id } });
      } else {
        console.warn(`⚠️ Ingrédient "${startFromName}" non trouvé. L'analyse commencera depuis le début.`);
      }
    }

    if (limit > 0) {
      query = query.limit(limit);
      console.log(`📊 Analyse limitée à ${limit} ingrédients...`);
    }

    const ingredients = await query;
    console.log(`📊 Analyse de ${ingredients.length} ingrédients...`);

    // Statistiques
    const stats = {
      total: ingredients.length,
      analyzed: 0,
      updated: 0,
      failed: 0,
      aiAnalysis: 0,
      proceduralAnalysis: 0,
      byType: {},
      commonChanges: {}
    };

    // Initialiser les compteurs par type
    Object.keys(TYPE_VALIDATION_RULES).forEach(type => {
      stats.byType[type] = 0;
    });
    stats.byType.other = 0;

    // Analyser chaque ingrédient
    const results = [];

    // Compteur de timeouts consécutifs
    let consecutiveTimeouts = 0;

    for (const ingredient of ingredients) {
      try {
        // Mettre à jour les statistiques par type
        stats.byType[ingredient.type] = (stats.byType[ingredient.type] || 0) + 1;

        let result = null;

        // Essayer d'abord l'analyse IA si disponible et non forcé en procédural
        if (aiProvider && !forceProceduralOnly) {
          try {
            result = await analyzeIngredientWithAI(ingredient, aiProvider, maxRetries, verbose);

            if (result) {
              stats.aiAnalysis++;
              // Réinitialiser le compteur de timeouts consécutifs en cas de succès
              consecutiveTimeouts = 0;
            }
          } catch (error) {
            // Vérifier si c'est un timeout
            if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
              consecutiveTimeouts++;
              console.error(`⏱️ TIMEOUT #${consecutiveTimeouts} détecté lors de l'analyse de "${ingredient.name}"`);

              // Si on atteint le nombre maximum de timeouts consécutifs, arrêter le script
              if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
                console.error(`\n⛔ ARRÊT DU SCRIPT: ${consecutiveTimeouts} timeouts consécutifs détectés.`);
                console.error(`\n📌 POINT D'ARRÊT: L'analyse s'est arrêtée à l'ingrédient "${ingredient.name}".`);
                console.error(`\n🔄 Pour reprendre l'analyse, utilisez la commande:`);
                console.error(`node src/scripts/validators/validateIngredientsWithAI.js --start-from "${ingredient.name}" [autres options]`);

                // Exporter les résultats partiels si demandé
                if (shouldExport && results.length > 0) {
                  const filepath = exportToCSV(results, stats);
                  console.log(`\n📋 Les résultats partiels ont été exportés dans ${filepath}`);
                }

                // Fermer la connexion à la base de données et quitter
                await mongoose.connection.close();
                console.log('✓ Connexion à MongoDB fermée');
                process.exit(1);
              }

              // Continuer avec l'analyse procédurale
              console.log(`🔄 Basculement vers l'analyse procédurale pour "${ingredient.name}" après timeout...`);
            } else {
              // Si ce n'est pas un timeout, réinitialiser le compteur
              consecutiveTimeouts = 0;
              console.error(`❌ Erreur lors de l'analyse IA de "${ingredient.name}":`, error.message);
            }
          }
        }

        // Si l'analyse IA a échoué ou n'est pas disponible, utiliser l'analyse procédurale
        if (!result) {
          console.log(`🔍 Analyse procédurale de l'ingrédient "${ingredient.name}" (${ingredient._id})...`);
          result = validateAndCorrectIngredient(ingredient);
          stats.proceduralAnalysis++;
          // Réinitialiser le compteur de timeouts consécutifs en cas de succès
          consecutiveTimeouts = 0;
        }

        stats.analyzed++;

        if (result.hasChanges) {
          results.push(result);

          // Compter les types de changements
          result.changes.forEach(change => {
            const changeType = change.split(':')[0].trim(); // Prendre la première partie comme type de changement
            stats.commonChanges[changeType] = (stats.commonChanges[changeType] || 0) + 1;
          });

          // Appliquer les corrections si demandé
          if (shouldFix && result.updatedData) {
            try {
              // Supprimer les champs qui ne sont pas dans le schéma
              delete result.updatedData._id;
              delete result.updatedData.__v;
              delete result.updatedData.createdAt;
              delete result.updatedData.updatedAt;

              await Ingredient.updateOne({ _id: result.id }, { $set: result.updatedData });
              console.log(`✅ Corrigé: ${result.name} (méthode: ${result.analysisMethod})`);
              stats.updated++;
            } catch (error) {
              console.error(`❌ Erreur lors de la correction de ${result.name}:`, error.message);
            }
          }
        } else {
          console.log(`✓ Aucune modification nécessaire pour "${ingredient.name}" (méthode: ${result.analysisMethod})`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'analyse de "${ingredient.name}":`, error.message);
        stats.failed++;
      }

      // Attendre un peu entre chaque analyse pour ne pas surcharger le système/API
      await new Promise(resolve => setTimeout(resolve, aiProvider && !forceProceduralOnly ? 1000 : 100));
    }

    // Afficher les résultats
    console.log('\n📊 STATISTIQUES:');
    console.log(`Total d'ingrédients: ${stats.total}`);
    console.log(`Ingrédients analysés: ${stats.analyzed}`);
    console.log(`Ingrédients avec modifications: ${results.length} (${Math.round(results.length/stats.analyzed*100)}%)`);
    console.log(`Ingrédients en échec: ${stats.failed} (${Math.round(stats.failed/stats.total*100)}%)`);
    console.log(`Analyses par IA: ${stats.aiAnalysis} (${Math.round(stats.aiAnalysis/stats.analyzed*100)}%)`);
    console.log(`Analyses procédurales: ${stats.proceduralAnalysis} (${Math.round(stats.proceduralAnalysis/stats.analyzed*100)}%)`);
    if (shouldFix) {
      console.log(`Ingrédients mis à jour: ${stats.updated}`);
    }

    console.log('\nRépartition par type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} (${Math.round(count/stats.total*100)}%)`);
    });

    console.log('\nModifications les plus courantes:');
    Object.entries(stats.commonChanges)
      .sort((a, b) => b[1] - a[1])
      .forEach(([change, count]) => {
        console.log(`- ${change}: ${count}`);
      });

    console.log('\n🔍 DÉTAILS DES MODIFICATIONS:');
    results.forEach(result => {
      if (result.changes.length > 0) {
        console.log(`\n${result.name} (${result.originalType} -> ${result.type}, ID: ${result.id}, méthode: ${result.analysisMethod}):`);
        console.log(`  Explication: ${result.explanation}`);
        console.log(`  Modifications:`);
        result.changes.forEach(change => {
          console.log(`  - ${change}`);
        });
      }
    });

    // Exporter les résultats si demandé
    if (shouldExport) {
      const filepath = exportToCSV(results, stats);
      console.log(`\n📋 Les résultats ont été exportés dans ${filepath}`);
    }

    // Afficher les instructions
    console.log('\n🔧 OPTIONS DISPONIBLES:');
    if (!shouldFix) {
      console.log('--fix                : Appliquer les corrections automatiquement');
    }
    if (!shouldExport) {
      console.log('--export             : Exporter les résultats en CSV');
    }
    console.log('--limit N             : Limiter le nombre d\'ingrédients analysés');
    console.log('--max-retries N       : Modifier le nombre maximum de tentatives pour l\'IA');
    console.log('--procedural-only     : Utiliser uniquement l\'analyse procédurale (sans IA)');
    console.log('--verbose             : Afficher les logs détaillés pour le débogage');
    console.log('--start-from "nom"    : Reprendre l\'analyse à partir de l\'ingrédient spécifié');
    console.log('--max-consecutive-timeouts N : Nombre de timeouts consécutifs avant arrêt (défaut: 3)');

  } catch (error) {
    console.error('Erreur globale:', error);
  } finally {
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
    console.log('✓ Connexion à MongoDB fermée');
  }
}

// Lancer l'analyse
console.log('🔍 Démarrage de l\'analyse des ingrédients...');
analyzeDatabase().then(() => {
  console.log('✅ Analyse terminée');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erreur lors de l\'analyse:', err);
  process.exit(1);
});