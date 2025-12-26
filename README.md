# JobMatch Browser Extension

Extension navigateur pour capturer des offres d'emploi depuis n'importe quel site web et les envoyer à JobMatch pour analyse et matching CV.

## Fonctionnalités

- **Bouton flottant** : Apparaît automatiquement sur les pages d'offres d'emploi
- **Extraction intelligente** : Utilise JSON-LD, meta tags et heuristiques pour extraire les informations
- **Préservation du formatage** : Les descriptions sont converties en Markdown (listes, gras, italique)
- **Sites supportés** : LinkedIn, Indeed, Welcome to the Jungle, et tout site avec données structurées
- **Authentification JWT** : Connexion sécurisée à votre compte JobMatch
- **Multi-navigateur** : Chrome, Edge et Firefox

## Installation (Développement)

### Prérequis

- Node.js 18+
- npm

### 1. Cloner et installer

```bash
git clone <repo-url>
cd jobmatchwebbrowerplugin
npm install
```

### 2. Configurer l'API (optionnel)

Par défaut, l'extension pointe vers `http://localhost:8085`. Pour modifier :

```typescript
// src/config.ts
export const DEFAULT_API_URL = 'http://localhost:8085';
```

### 3. Build

```bash
# Build pour Chrome/Edge (sortie dans dist/)
npm run build

# Build pour Firefox (sortie dans dist-firefox/)
npm run build:firefox

# Build pour tous les navigateurs
npm run build:all

# Mode watch (rebuild automatique à chaque modification)
npm run watch
```

### 4. Charger l'extension en mode développeur

#### Chrome

1. Ouvrir `chrome://extensions/`
2. Activer **"Mode développeur"** (toggle en haut à droite)
3. Cliquer **"Charger l'extension non empaquetée"**
4. Sélectionner le dossier `dist/`
5. L'extension apparaît dans la barre d'outils

**Pour recharger après modification :**
- Cliquer sur l'icône 🔄 de l'extension dans `chrome://extensions/`
- Puis rafraîchir la page web (F5)

#### Edge

1. Ouvrir `edge://extensions/`
2. Activer **"Mode développeur"** (toggle en bas à gauche)
3. Cliquer **"Charger l'élément décompressé"**
4. Sélectionner le dossier `dist/`

**Pour recharger :** même procédure que Chrome

#### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`
2. Cliquer **"Charger un module complémentaire temporaire..."**
3. Sélectionner le fichier `dist-firefox/manifest.json`

**Pour recharger après modification :**
- Cliquer sur **"Recharger"** à côté de l'extension
- Puis rafraîchir la page web (F5)

> **Note Firefox :** L'extension temporaire est supprimée à la fermeture du navigateur. Pour une installation permanente, voir la section Publication.

## Structure du projet

```
src/
├── assets/           # Icônes et ressources statiques
├── background/       # Service worker (gestion auth, API)
├── content/          # Content script (extraction, bouton flottant)
├── extractors/       # Extracteurs par site
│   ├── base.ts       # Interface et utilitaires
│   ├── generic.ts    # Extracteur générique (JSON-LD, heuristiques)
│   ├── linkedin.ts   # Extracteur LinkedIn
│   ├── indeed.ts     # Extracteur Indeed
│   └── welcometothejungle.ts
├── lib/              # Bibliothèques partagées
│   ├── api.ts        # Client API JobMatch
│   └── storage.ts    # Abstraction stockage
├── options/          # Page de paramètres
├── popup/            # Popup de l'extension
├── types/            # Types TypeScript
├── manifest.json     # Manifest Chrome/Edge (v3)
└── manifest.firefox.json  # Manifest Firefox (v3)
```

## Configuration

### Paramètres disponibles

- **URL de l'API** : Adresse du serveur JobMatch (défaut: `http://localhost:8085`)
- **Bouton flottant** : Afficher/masquer le bouton sur les pages d'emploi
- **Thème** : Clair, sombre ou système

## API Backend (à implémenter)

L'extension attend les endpoints suivants sur le serveur JobMatch :

```
POST /api/auth/token/          # Obtenir JWT (email, password)
POST /api/auth/token/refresh/  # Rafraîchir JWT
GET  /api/auth/user/           # Info utilisateur connecté
POST /api/offers/import/       # Importer une offre
GET  /api/offers/              # Lister les offres
GET  /api/health/              # Health check
```

## Scripts disponibles

```bash
npm run build       # Build Chrome/Edge
npm run build:firefox  # Build Firefox
npm run build:all   # Build tous
npm run watch       # Build avec watch
npm run type-check  # Vérification TypeScript
npm run lint        # Linter
npm run format      # Formatter (Prettier)
npm run clean       # Nettoyer dist/
```

## Publication sur les Stores

### Préparation

Avant de soumettre, vérifiez :

1. **Icônes** : Créez les icônes dans `src/assets/` (16x16, 32x32, 48x48, 128x128 px)
2. **Screenshots** : Préparez 3-5 captures d'écran (1280x800 ou 640x400 px)
3. **Description** : Rédigez une description courte (132 chars) et longue
4. **Politique de confidentialité** : URL requise (hébergée sur votre site)

### Chrome Web Store

1. **Créer un compte développeur** : https://chrome.google.com/webstore/devconsole/
   - Frais uniques : 5 USD

2. **Packager l'extension**
   ```bash
   npm run build
   cd dist
   zip -r ../jobmatch-chrome.zip .
   ```

3. **Soumettre**
   - Aller dans la Developer Dashboard
   - Cliquer "Nouvel élément"
   - Uploader `jobmatch-chrome.zip`
   - Remplir les informations (description, screenshots, catégorie)
   - Soumettre pour review (délai : 1-3 jours)

### Microsoft Edge Add-ons

1. **Créer un compte développeur** : https://partner.microsoft.com/dashboard/microsoftedge/
   - Gratuit

2. **Packager** (même build que Chrome)
   ```bash
   npm run build
   cd dist
   zip -r ../jobmatch-edge.zip .
   ```

3. **Soumettre**
   - Aller dans le Partner Center
   - Cliquer "Créer une extension"
   - Uploader `jobmatch-edge.zip`
   - Remplir les métadonnées
   - Soumettre (délai : 1-7 jours)

### Firefox Add-ons (AMO)

1. **Créer un compte** : https://addons.mozilla.org/developers/
   - Gratuit

2. **Packager l'extension**
   ```bash
   npm run build:firefox
   cd dist-firefox
   zip -r ../jobmatch-firefox.zip .
   ```

3. **Soumettre**
   - Aller sur https://addons.mozilla.org/developers/addon/submit/
   - Choisir "Sur ce site" (listed)
   - Uploader `jobmatch-firefox.zip`
   - Uploader également le code source (zip du repo) pour review
   - Soumettre (délai : 1-2 jours pour auto-approval, plus si review manuelle)

### Checklist pré-publication

- [ ] Tester sur Chrome, Edge et Firefox
- [ ] Vérifier que l'API de production est configurée
- [ ] Supprimer les logs de debug (`CONFIG.DEBUG = false`)
- [ ] Vérifier les permissions (ne demander que le minimum)
- [ ] Tester l'extraction sur les principaux sites d'emploi
- [ ] Préparer les assets visuels (icônes, screenshots)
- [ ] Rédiger la politique de confidentialité

## Mise à jour de l'extension

### En développement

```bash
# 1. Modifier le code
# 2. Rebuild
npm run build:firefox  # ou npm run build

# 3. Recharger dans le navigateur
# Firefox: about:debugging → Recharger
# Chrome/Edge: chrome://extensions → 🔄
```

### En production (stores)

1. Incrémenter la version dans `src/manifest.json` et `src/manifest.firefox.json`
2. Build et packager
3. Uploader la nouvelle version sur le store
4. Les utilisateurs reçoivent la mise à jour automatiquement

## Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit (`git commit -m 'Ajouter nouvelle fonctionnalité'`)
4. Push (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## Licence

MIT
