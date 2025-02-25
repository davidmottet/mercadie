import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../../config/default.js';
import getAIProvider from '../services/aiProvider.js';
import Ingredient from '../models/ingredient.js';
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

// Fonction pour générer le prompt système pour l'IA
function generateSystemPrompt(ingredient) {
  return `Tu es un expert en nutrition et en alimentation. Analyse cet ingrédient et vérifie sa cohérence:

${JSON.stringify(ingredient, null, 2)}

Réponds UNIQUEMENT avec un objet JSON contenant:
1. L'ingrédient corrigé avec tous les champs originaux
2. Un champ "changes" listant les modifications apportées
3. Un champ "explanation" expliquant pourquoi ces changements sont nécessaires

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

Réponds UNIQUEMENT avec un objet JSON valide.`;
}

// Fonction pour exporter les résultats dans un fichier CSV
function exportToCSV(results, stats) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `ingredient-ai-analysis-${timestamp}.csv`;
  const filepath = path.join(process.cwd(), filename);
  
  // Créer l'en-tête du CSV
  let csvContent = 'ID,Name,Type,Changes,Explanation\n';
  
  // Ajouter les données
  results.forEach(result => {
    const changes = result.changes.join(' | ').replace(/,/g, ';'); // Remplacer les virgules pour éviter de casser le CSV
    const explanation = result.explanation.replace(/,/g, ';').replace(/\n/g, ' '); // Nettoyer l'explication
    csvContent += `${result.id},${result.name},${result.type},"${changes}","${explanation}"\n`;
  });
  
  // Ajouter les statistiques
  csvContent += '\nStatistics\n';
  csvContent += `Total ingredients,${stats.total}\n`;
  csvContent += `Ingredients analyzed,${stats.analyzed}\n`;
  csvContent += `Ingredients updated,${stats.updated}\n`;
  
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

// Fonction pour analyser un ingrédient avec l'IA
async function analyzeIngredientWithAI(ingredient, aiProvider) {
  try {
    console.log(`🔍 Analyse de l'ingrédient "${ingredient.name}" (${ingredient._id})...`);
    
    // Générer le prompt pour l'IA
    const prompt = generateSystemPrompt(ingredient.toObject());
    
    // Obtenir l'analyse de l'IA
    const analysis = await aiProvider.generateCompletion(prompt);
    
    // Vérifier que l'analyse est valide
    if (!analysis || !analysis.changes) {
      console.error(`❌ Analyse invalide pour "${ingredient.name}"`);
      return null;
    }
    
    // Extraire les modifications à appliquer
    const updatedIngredient = { ...analysis };
    delete updatedIngredient.changes;
    delete updatedIngredient.explanation;
    
    // Vérifier si des modifications sont nécessaires
    const hasChanges = analysis.changes && analysis.changes.length > 0;
    
    return {
      id: ingredient._id,
      name: ingredient.name,
      type: ingredient.type,
      originalType: ingredient.type,
      changes: analysis.changes || [],
      explanation: analysis.explanation || '',
      updatedData: hasChanges ? updatedIngredient : null,
      hasChanges: hasChanges
    };
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'analyse de "${ingredient.name}":`, error.message);
    return null;
  }
}

// Fonction principale pour analyser la base de données
async function analyzeDatabase() {
  // Vérifier les arguments
  const shouldFix = process.argv.includes('--fix');
  const shouldExport = process.argv.includes('--export');
  const limit = process.argv.includes('--limit') 
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
    : 0;
  
  try {
    // Connexion à MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('✓ Connecté à MongoDB');
    
    // Initialiser le fournisseur d'IA
    const aiProvider = getAIProvider('ollama');
    
    // Récupérer tous les ingrédients
    let query = Ingredient.find({});
    if (limit > 0) {
      query = query.limit(limit);
      console.log(`📊 Analyse limitée à ${limit} ingrédients...`);
    }
    
    const ingredients = await query;
    console.log(`📊 Analyse de ${ingredients.length} ingrédients avec l'IA...`);
    
    // Statistiques
    const stats = {
      total: ingredients.length,
      analyzed: 0,
      updated: 0,
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
    
    for (const ingredient of ingredients) {
      // Mettre à jour les statistiques par type
      stats.byType[ingredient.type] = (stats.byType[ingredient.type] || 0) + 1;
      
      // Analyser l'ingrédient avec l'IA
      const result = await analyzeIngredientWithAI(ingredient, aiProvider);
      
      if (result) {
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
              console.log(`✅ Corrigé: ${result.name}`);
              stats.updated++;
            } catch (error) {
              console.error(`❌ Erreur lors de la correction de ${result.name}:`, error.message);
            }
          }
        } else {
          console.log(`✓ Aucune modification nécessaire pour "${ingredient.name}"`);
        }
      }
      
      // Attendre un peu entre chaque analyse pour ne pas surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Afficher les résultats
    console.log('\n📊 STATISTIQUES:');
    console.log(`Total d'ingrédients: ${stats.total}`);
    console.log(`Ingrédients analysés: ${stats.analyzed}`);
    console.log(`Ingrédients avec modifications: ${results.length} (${Math.round(results.length/stats.analyzed*100)}%)`);
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
        console.log(`\n${result.name} (${result.originalType} -> ${result.type}, ID: ${result.id}):`);
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
    if (!shouldFix) {
      console.log('\n🔧 CORRECTIONS AUTOMATIQUES POSSIBLES:');
      console.log('Pour appliquer les corrections, exécutez ce script avec l\'argument --fix');
    }
    if (!shouldExport) {
      console.log('Pour exporter les résultats en CSV, utilisez l\'argument --export');
    }
    console.log('Pour limiter le nombre d\'ingrédients analysés, utilisez l\'argument --limit suivi d\'un nombre');
    
  } catch (error) {
    console.error('Erreur globale:', error);
  } finally {
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
    console.log('✓ Connexion à MongoDB fermée');
  }
}

// Lancer l'analyse
console.log('🔍 Démarrage de l\'analyse des ingrédients avec l\'IA...');
analyzeDatabase().then(() => {
  console.log('✅ Analyse terminée');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erreur lors de l\'analyse:', err);
  process.exit(1);
}); 