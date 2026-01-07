# Postmortem - JobMatch Browser Extension

## 📅 Sessions

### 2025-12-26 - Documentation et configuration d'environnement

**Contexte:**
Amélioration de la documentation et ajout du support des variables d'environnement pour faciliter le déploiement dev/prod.

**Réalisations:**
- Création de `.env.example` avec `API_URL` configurable
- Création de `build.sh` : script bash qui charge `.env` et met à jour `src/config.ts`
- Mise à jour du README avec :
  - Instructions détaillées de build avec `./build.sh`
  - Section Publication sur les stores (Chrome, Edge, Firefox)
  - Checklist pré-publication
  - Instructions de mise à jour en dev et prod
- Ajout de `.claude/` au `.gitignore`

**Décisions techniques:**
- **build.sh plutôt que dotenv** : Pas de dépendance npm supplémentaire, le script bash génère directement `src/config.ts`
- **Variables d'environnement au build** : L'URL API est "baked" dans le bundle, pas de runtime config nécessaire

---

### 2025-12-25 - Build system et conversion Markdown

**Contexte:**
Finalisation du build system et ajout de la préservation du formatage des descriptions d'offres.

**Réalisations:**
- Remplacement de Vite + CRXJS par esbuild (script custom `scripts/build.js`)
- Création de `src/lib/html-to-markdown.ts` pour convertir les descriptions HTML en Markdown
- Mise à jour de tous les extracteurs pour utiliser la conversion Markdown
- Centralisation de la config API dans `src/config.ts` (DEFAULT_API_URL)
- Tests réussis sur Firefox

**Problèmes rencontrés:**
- **CRXJS/Vite incompatibilité Node.js** : Le plugin @crxjs/vite-plugin utilisait cheerio/undici qui nécessitaient Node 20+
- **Erreur de copie CSS** : `copyFileSync` échouait car le dossier cible n'existait pas
- **Erreurs CSP LinkedIn** : Warnings dans la console Firefox (pas bloquant, CSP de LinkedIn)

**Solutions appliquées:**
- Remplacement par script esbuild custom (`scripts/build.js`) - plus simple, pas de dépendances problématiques
- Ajout de `fs.mkdirSync(path.dirname(dest), { recursive: true })` avant `copyFileSync`
- Les erreurs CSP LinkedIn sont normales et n'affectent pas l'extension

**Décisions techniques:**
- **esbuild au lieu de Vite** : Plus léger, moins de dépendances, build direct sans abstraction
- **Markdown pour descriptions** : Préserve bullet points, gras, italique, listes - meilleure expérience utilisateur

---

### 2025-12-24 - Création de l'architecture initiale

**Contexte:**
Création d'une extension navigateur (Chrome, Firefox, Edge) pour capturer des offres d'emploi depuis n'importe quel site web et les envoyer à l'application JobMatch existante.

**Réalisations:**
- Architecture complète de l'extension définie (Manifest V3, TypeScript, esbuild)
- Structure du projet créée avec tous les fichiers sources :
  - Background service worker pour la gestion auth et API
  - Content script avec bouton flottant et extraction
  - Popup UI avec login et preview d'offres
  - Page options pour les paramètres
- Système d'extraction modulaire avec extracteurs spécialisés :
  - Generic (JSON-LD, meta tags, heuristiques)
  - LinkedIn Jobs
  - Indeed
  - Welcome to the Jungle
- Système d'authentification JWT préparé
- Types TypeScript complets avec Zod pour la validation

**Décisions techniques:**
- **Manifest V3** : Obligatoire pour Chrome/Edge, supporté par Firefox 109+
- **TypeScript + esbuild** : Build rapide et fiable
- **Vanilla JS pour l'UI** : Léger, pas de dépendances framework, meilleure compatibilité
- **JWT avec refresh tokens** : Standard, sécurisé, compatible avec Django REST Framework
- **Extracteurs modulaires** : Facilite l'ajout de nouveaux sites sans modifier le code existant

**Problèmes rencontrés:**
- (Voir session 2025-12-25 pour les problèmes de build)

**Solutions appliquées:**
- (Voir session 2025-12-25)

## 🧠 Apprentissages clés
- Les extensions Manifest V3 utilisent des service workers au lieu de background pages
- Firefox nécessite un manifest légèrement différent (browser_specific_settings)
- JSON-LD JobPosting est le meilleur moyen d'extraire des données structurées
- **esbuild est plus fiable que Vite+CRXJS** pour les extensions browser (moins de dépendances)
- **Markdown est le bon format** pour préserver le formatage des descriptions d'offres

## ⚠️ Pièges à éviter
- Ne pas oublier les permissions host_permissions pour les appels API
- Les service workers peuvent être tués par le navigateur, gérer l'état dans storage
- Le content script doit avoir des styles isolés (préfixés) pour éviter les conflits
- **Vite+CRXJS** : dépendances transitives (cheerio/undici) peuvent nécessiter Node 20+
- **fs.copyFileSync** : toujours créer le dossier parent avec `mkdirSync({ recursive: true })`
- **Erreurs CSP tierces** : les sites comme LinkedIn ont leur propre CSP, ça génère des warnings mais n'empêche pas l'extension de fonctionner

## 🏗️ Patterns qui fonctionnent
- Extracteurs avec interface commune et priorité
- Storage abstraction layer pour cross-browser
- Message passing typé entre background/content/popup
- **Script de build custom esbuild** : plus de contrôle, moins de magie
- **HTML→Markdown conversion** : préserve la structure sans les balises HTML
- **build.sh + .env** : configuration d'environnement sans dépendances npm

## 📋 TODO / Dette technique
- [ ] **Ajouter les endpoints API côté Django (JobMatch)** - PRIORITÉ HAUTE
  - POST /api/offers/import/ (doit accepter le champ description en Markdown)
  - POST /api/auth/token/
  - POST /api/auth/token/refresh/
  - GET /api/auth/user/
- [ ] Créer les icônes de l'extension (16, 32, 48, 128px)
- [ ] Ajouter des tests unitaires pour les extracteurs
- [ ] Implémenter le refresh token automatique
- [ ] Ajouter le support i18n (français/anglais)
- [ ] Tester sur les principaux sites d'emploi (Indeed, LinkedIn, WTTJ)
- [ ] Préparer les assets pour les stores (screenshots, descriptions)
- [ ] Tester sur Chrome et Edge (testé uniquement sur Firefox pour l'instant)

## 🔧 Commandes utiles
```bash
# Build avec variables d'environnement (recommandé)
./build.sh              # Build tous (Chrome + Firefox)
./build.sh chrome       # Chrome/Edge uniquement
./build.sh firefox      # Firefox uniquement

# Build production
API_URL=http://jobmatch.molp.fr ./build.sh

# Build avec npm (valeurs par défaut)
npm run build           # Chrome/Edge
npm run build:firefox   # Firefox
npm run watch           # Watch mode

# Recharger extension
# Firefox: about:debugging#/runtime/this-firefox → Recharger
# Chrome/Edge: chrome://extensions → 🔄
```
