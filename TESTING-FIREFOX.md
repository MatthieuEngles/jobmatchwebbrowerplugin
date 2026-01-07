# Guide de test - Firefox

## 1. Prérequis

- Firefox 109+ installé
- Node.js 18+
- API JobMatch running sur `localhost:8085` (optionnel pour test UI)

## 2. Build de l'extension

```bash
# Installer les dépendances (première fois uniquement)
npm install

# Build pour Firefox
./build.sh firefox

# Ou sans le script
npm run build:firefox
```

Résultat : dossier `dist-firefox/` créé avec l'extension compilée.

## 3. Charger l'extension dans Firefox

1. Ouvrir Firefox
2. Taper `about:debugging` dans la barre d'adresse
3. Cliquer sur **"Ce Firefox"** (ou "This Firefox")
4. Cliquer sur **"Charger un module complémentaire temporaire..."**
5. Naviguer vers le projet et sélectionner : `dist-firefox/manifest.json`

L'extension apparaît dans la liste avec un bouton "Inspecter" et "Recharger".

## 4. Vérifier l'installation

- L'icône JobMatch devrait apparaître dans la barre d'outils Firefox
- Cliquer dessus pour ouvrir le popup

## 5. Tester l'extraction d'offres

### Sites de test recommandés

| Site | URL de test |
|------|-------------|
| LinkedIn | https://www.linkedin.com/jobs/ (chercher une offre) |
| Indeed | https://fr.indeed.com/ (chercher une offre) |
| Welcome to the Jungle | https://www.welcometothejungle.com/fr/jobs |
| HelloWork | https://www.hellowork.com/fr-fr/emploi/recherche.html |

### Procédure de test

1. Aller sur une page d'offre d'emploi
2. Un bouton flottant **"+ JobMatch"** doit apparaître (coin inférieur droit)
3. Cliquer sur le bouton
4. Une fenêtre de preview s'affiche avec les données extraites :
   - Titre du poste
   - Entreprise
   - Localisation
   - Description (en Markdown)
   - URL source

## 6. Ouvrir la console de debug

### Console du content script (page web)
1. Sur la page d'offre, appuyer sur `F12`
2. Onglet **Console**
3. Les logs de l'extracteur s'affichent ici

### Console du background script (service worker)
1. Aller à `about:debugging#/runtime/this-firefox`
2. Trouver l'extension JobMatch
3. Cliquer sur **"Inspecter"**
4. La console du service worker s'ouvre

### Console du popup
1. Cliquer sur l'icône JobMatch pour ouvrir le popup
2. Clic droit sur le popup → **"Inspecter"**
3. Ou : dans about:debugging, cliquer "Inspecter" sur l'extension

## 7. Recharger après modifications

```bash
# 1. Modifier le code source

# 2. Rebuild
./build.sh firefox

# 3. Dans about:debugging → Cliquer "Recharger" sur l'extension

# 4. Rafraîchir la page web (F5) pour recharger le content script
```

## 8. Tester les paramètres

1. Clic droit sur l'icône JobMatch → **"Gérer l'extension"**
2. Ou aller à `about:addons` → JobMatch → **"Préférences"**
3. Modifier l'URL de l'API, activer/désactiver le bouton flottant

## 9. Problèmes courants

### Le bouton flottant n'apparaît pas
- Vérifier que la page est bien une offre d'emploi
- Ouvrir la console (F12) pour voir les erreurs
- L'extracteur n'a peut-être pas reconnu la page

### Erreurs CSP dans la console
```
Content-Security-Policy: Les paramètres de la page ont empêché...
```
**Ce n'est pas une erreur de l'extension.** C'est la CSP du site visité (LinkedIn, etc.). L'extension fonctionne quand même.

### L'extension ne se charge pas
- Vérifier que le build a réussi (`dist-firefox/` existe)
- Vérifier les erreurs dans about:debugging
- Supprimer et recharger l'extension

### Erreurs de connexion API
- Vérifier que l'API tourne sur le bon port
- Vérifier l'URL dans les paramètres de l'extension
- Ouvrir la console du background script pour voir les erreurs réseau

## 10. Checklist de test

- [ ] Build réussi (`./build.sh firefox`)
- [ ] Extension chargée dans Firefox
- [ ] Popup s'ouvre au clic sur l'icône
- [ ] Page options accessible
- [ ] Bouton flottant visible sur LinkedIn Jobs
- [ ] Bouton flottant visible sur Indeed
- [ ] Bouton flottant visible sur WTTJ
- [ ] Preview des données extraites correct
- [ ] Description en Markdown (bullets, gras préservés)
- [ ] Connexion à l'API fonctionne (si API disponible)
