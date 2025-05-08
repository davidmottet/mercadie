# Mercadie

Application de suivi et de gestion personnelle.

## Structure du Projet

### Dossiers Principaux

- `src/` : Dossier principal contenant tout le code source de l'application
- `components/` : Composants React réutilisables
- `services/` : Services pour la gestion des données et l'interaction avec l'API
- `utils/` : Fonctions utilitaires et helpers
- `types/` : Définitions des types TypeScript
- `data/` : Données statiques et constantes

### Fichiers de Configuration

- `package.json` : Dépendances et scripts npm
- `tsconfig.json` : Configuration TypeScript
- `vite.config.ts` : Configuration de Vite (bundler)
- `tailwind.config.js` : Configuration de Tailwind CSS
- `eslint.config.js` : Configuration ESLint pour le linting
- `postcss.config.js` : Configuration PostCSS

### Fichiers Source Principaux

- `src/main.tsx` : Point d'entrée de l'application
- `src/App.tsx` : Composant racine de l'application
- `src/parseConfig.ts` : Configuration de Parse (backend)
- `src/parseModels.ts` : Modèles de données Parse

## Guide de Développement

### Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Construire pour la production
npm run build
```

### Conventions de Code

1. **Composants React**
   - Placer les composants réutilisables dans `src/components/`
   - Utiliser des composants fonctionnels avec hooks
   - Nommer les fichiers en PascalCase (ex: `Button.tsx`)

2. **Services**
   - Placer la logique métier dans `src/services/`
   - Créer des services séparés pour chaque domaine fonctionnel
   - Utiliser des interfaces TypeScript pour les types de données

3. **Utilitaires**
   - Placer les fonctions utilitaires dans `src/utils/`
   - Créer des fichiers spécifiques pour chaque catégorie d'utilitaires
   - Documenter les fonctions complexes

4. **Types**
   - Définir les interfaces et types dans `src/types/`
   - Exporter les types utilisés dans plusieurs fichiers
   - Utiliser des types stricts pour une meilleure sécurité

### Bonnes Pratiques

1. **Gestion d'État**
   - Utiliser React Context pour l'état global
   - Préférer les hooks personnalisés pour la logique réutilisable
   - Éviter la duplication de code

2. **Style**
   - Utiliser Tailwind CSS pour le styling
   - Suivre une approche mobile-first
   - Maintenir une cohérence visuelle

3. **Performance**
   - Optimiser les rendus avec `useMemo` et `useCallback`
   - Implémenter le lazy loading pour les composants lourds
   - Minimiser les requêtes API

4. **Tests**
   - Écrire des tests unitaires pour les composants critiques
   - Utiliser des tests d'intégration pour les flux importants
   - Maintenir une bonne couverture de tests

## Contribution

1. Créer une branche pour chaque nouvelle fonctionnalité
2. Suivre les conventions de code existantes
3. Ajouter des tests pour les nouvelles fonctionnalités
4. Documenter les changements importants
5. Créer une pull request avec une description claire

## Déploiement

Le déploiement est géré automatiquement via GitHub Actions. Les changements sur la branche principale déclenchent automatiquement un déploiement.

## Support

Pour toute question ou problème, veuillez créer une issue sur GitHub. 