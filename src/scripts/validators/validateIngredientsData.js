import 'dotenv/config';
import process from 'process';
import mongoose from 'mongoose';
import config from '../../../config/default.js';
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

// Ingrédients communs qui devraient avoir ignoreShoppingList = true
const COMMON_INGREDIENTS = [
  'salt', 'pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'water',
  'garlic', 'onion', 'butter', 'milk', 'eggs', 'rice', 'pasta', 'bread'
];

// Ingrédients qui contiennent du porc
const PORK_KEYWORDS = [
  'pork', 'ham', 'bacon', 'sausage', 'prosciutto', 'pancetta', 'lard', 'chorizo'
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

// Fonction pour vérifier si un ingrédient est commun
function isCommonIngredient (name) {
  return COMMON_INGREDIENTS.some(common => name.includes(common));
}

// Fonction pour vérifier si un ingrédient contient du porc
function containsPork (name) {
  return PORK_KEYWORDS.some(keyword => name.includes(keyword));
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

// Fonction pour suggérer des saisons appropriées pour un ingrédient
function suggestSeasons (type, name) {
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

// Fonction pour vérifier si les saisons sont cohérentes
function checkSeasonalAvailability (months) {
  // Si tous les mois sont présents, c'est disponible toute l'année
  const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const isAllYear = allMonths.every(month => months.includes(month));

  if (isAllYear) {
    return { isAllYear: true, seasons: ['summer', 'autumn', 'winter', 'spring'] };
  }

  // Sinon, déterminer les saisons disponibles
  const availableSeasons = [];

  const summerMonths = SEASONS.SUMMER.filter(month => months.includes(month));
  if (summerMonths.length > 0) availableSeasons.push('summer');

  const autumnMonths = SEASONS.AUTUMN.filter(month => months.includes(month));
  if (autumnMonths.length > 0) availableSeasons.push('autumn');

  const winterMonths = SEASONS.WINTER.filter(month => months.includes(month));
  if (winterMonths.length > 0) availableSeasons.push('winter');

  const springMonths = SEASONS.SPRING.filter(month => months.includes(month));
  if (springMonths.length > 0) availableSeasons.push('spring');

  return { isAllYear: false, seasons: availableSeasons };
}

// Fonction pour valider un ingrédient
function validateIngredient (ingredient) {
  const issues = [];
  const name = ingredient.name.toLowerCase();
  const type = ingredient.type || 'other';

  // Vérifier le type
  if (!type || type === 'other') {
    // Essayer de déterminer le type basé sur le nom
    const detectedType = detectIngredientType(name);
    if (detectedType !== 'other') {
      issues.push(`Type devrait être '${detectedType}' pour ${name}`);
    }
  }

  // Vérifier les règles spécifiques au type
  const rules = TYPE_VALIDATION_RULES[type];
  if (rules) {
    if (rules.frozenOrCanned !== undefined && ingredient.frozenOrCanned !== rules.frozenOrCanned) {
      issues.push(`frozenOrCanned devrait être ${rules.frozenOrCanned} pour ${type} ${name}`);
    }

    if (rules.storeShelf !== undefined && ingredient.storeShelf !== rules.storeShelf) {
      issues.push(`storeShelf devrait être ${rules.storeShelf} pour ${type} ${name}`);
    }

    if (rules.checkPork && !ingredient.withPork && containsPork(name)) {
      issues.push(`withPork devrait être true pour ${name}`);
    }

    if (rules.checkSeasons && ingredient.seasons && ingredient.seasons.length === 12) {
      issues.push(`${name} ne devrait pas être disponible toute l'année, vérifier les saisons`);
    }
  }

  // Vérifier ignoreShoppingList pour les ingrédients communs
  if (isCommonIngredient(name) && !ingredient.ignoreShoppingList) {
    issues.push(`ignoreShoppingList devrait être true pour l'ingrédient commun ${name}`);
  }

  // Vérifier withPork
  if (containsPork(name) && !ingredient.withPork) {
    issues.push(`withPork devrait être true pour ${name}`);
  }

  // Vérifier les saisons pour les fruits et légumes
  if ((type === 'fruit' || type === 'vegetable') && ingredient.seasons) {
    const seasonalInfo = checkSeasonalAvailability(ingredient.seasons);

    // Les fruits et légumes ne devraient généralement pas être disponibles toute l'année
    if (seasonalInfo.isAllYear && rules && rules.checkSeasons) {
      issues.push(`${name} ne devrait pas être disponible toute l'année, vérifier les saisons`);
    }

    // Vérifier si les saisons sont cohérentes (par exemple, pas seulement un mois isolé)
    if (!seasonalInfo.isAllYear && seasonalInfo.seasons.length === 0) {
      issues.push(`Saisons incohérentes pour ${name}: ${ingredient.seasons.join(', ')}`);
    }
  }

  return {
    id: ingredient._id,
    name: name,
    type: type,
    issues: issues
  };
}

// Fonction pour exporter les résultats dans un fichier CSV
function exportToCSV (results, stats) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `ingredient-analysis-${timestamp}.csv`;
  const filepath = path.join(process.cwd(), filename);

  // Créer l'en-tête du CSV
  let csvContent = 'ID,Name,Type,Issues\n';

  // Ajouter les données
  results.forEach(result => {
    const issues = result.issues.join(' | ').replace(/,/g, ';'); // Remplacer les virgules pour éviter de casser le CSV
    csvContent += `${result.id},${result.name},${result.type},"${issues}"\n`;
  });

  // Ajouter les statistiques
  csvContent += '\nStatistics\n';
  csvContent += `Total ingredients,${stats.total}\n`;
  csvContent += `Ingredients with issues,${stats.withIssues}\n`;

  csvContent += '\nDistribution by type\n';
  Object.entries(stats.byType).forEach(([type, count]) => {
    csvContent += `${type},${count},${Math.round(count/stats.total*100)}%\n`;
  });

  csvContent += '\nCommon issues\n';
  Object.entries(stats.commonIssues)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      csvContent += `${issue},${count}\n`;
    });

  // Écrire le fichier
  fs.writeFileSync(filepath, csvContent);
  console.log(`\n📊 Résultats exportés dans ${filename}`);

  return filepath;
}

// Fonction principale pour analyser la base de données
async function analyzeDatabase () {
  try {
    // Connexion à MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('✓ Connecté à MongoDB');

    // Récupérer tous les ingrédients
    const ingredients = await Ingredient.find({});
    console.log(`📊 Analyse de ${ingredients.length} ingrédients...`);

    // Statistiques
    const stats = {
      total: ingredients.length,
      withIssues: 0,
      byType: {},
      commonIssues: {}
    };

    // Initialiser les compteurs par type
    Object.keys(TYPE_VALIDATION_RULES).forEach(type => {
      stats.byType[type] = 0;
    });
    stats.byType.other = 0;

    // Analyser chaque ingrédient
    const results = [];

    for (const ingredient of ingredients) {
      const result = validateIngredient(ingredient);

      // Mettre à jour les statistiques
      stats.byType[result.type] = (stats.byType[result.type] || 0) + 1;

      if (result.issues.length > 0) {
        stats.withIssues++;
        results.push(result);

        // Compter les types de problèmes
        result.issues.forEach(issue => {
          const issueType = issue.split(' ')[0]; // Prendre le premier mot comme type de problème
          stats.commonIssues[issueType] = (stats.commonIssues[issueType] || 0) + 1;
        });
      }
    }

    // Afficher les résultats
    console.log('\n📊 STATISTIQUES:');
    console.log(`Total d'ingrédients: ${stats.total}`);
    console.log(`Ingrédients avec problèmes: ${stats.withIssues} (${Math.round(stats.withIssues/stats.total*100)}%)`);

    console.log('\nRépartition par type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} (${Math.round(count/stats.total*100)}%)`);
    });

    console.log('\nProblèmes les plus courants:');
    Object.entries(stats.commonIssues)
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`- ${issue}: ${count}`);
      });

    console.log('\n🔍 DÉTAILS DES PROBLÈMES:');
    results.forEach(result => {
      if (result.issues.length > 0) {
        console.log(`\n${result.name} (${result.type}, ID: ${result.id}):`);
        result.issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
      }
    });

    // Exporter les résultats si l'argument --export est présent
    if (process.argv.includes('--export')) {
      const filepath = exportToCSV(results, stats);
      console.log(`\n📋 Les résultats ont été exportés dans ${filepath}`);
    }

    // Proposer des corrections automatiques
    console.log('\n🔧 CORRECTIONS AUTOMATIQUES POSSIBLES:');
    console.log('Pour appliquer les corrections, exécutez ce script avec l\'argument --fix');
    console.log('Pour exporter les résultats en CSV, utilisez l\'argument --export');

    // Vérifier si l'argument --fix est présent
    if (process.argv.includes('--fix')) {
      console.log('\n🛠️ APPLICATION DES CORRECTIONS...');
      let fixCount = 0;

      for (const result of results) {
        if (result.issues.length > 0) {
          const updates = {};

          // Déterminer les corrections à appliquer
          result.issues.forEach(issue => {
            if (issue.includes('Type devrait être')) {
              const newType = issue.match(/'([^']+)'/)[1];
              updates.type = newType;
            } else if (issue.includes('frozenOrCanned devrait être')) {
              updates.frozenOrCanned = issue.includes('true');
            } else if (issue.includes('storeShelf devrait être')) {
              updates.storeShelf = parseInt(issue.match(/être (\d+)/)[1]);
            } else if (issue.includes('withPork devrait être true')) {
              updates.withPork = true;
            } else if (issue.includes('ignoreShoppingList devrait être true')) {
              updates.ignoreShoppingList = true;
            } else if (issue.includes('ne devrait pas être disponible toute l\'année')) {
              // Suggérer des saisons appropriées basées sur le type et le nom
              updates.seasons = suggestSeasons(result.type, result.name);
            }
          });

          if (Object.keys(updates).length > 0) {
            try {
              await Ingredient.updateOne({ _id: result.id }, { $set: updates });
              console.log(`✅ Corrigé: ${result.name}`);
              fixCount++;
            } catch (error) {
              console.error(`❌ Erreur lors de la correction de ${result.name}:`, error.message);
            }
          }
        }
      }

      console.log(`\n🎉 ${fixCount} ingrédients corrigés avec succès!`);
    }

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