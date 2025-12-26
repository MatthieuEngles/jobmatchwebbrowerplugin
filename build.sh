#!/bin/bash

# JobMatch Browser Extension - Build Script
# Usage:
#   ./build.sh              # Build all (Chrome + Firefox) avec .env
#   ./build.sh chrome       # Build Chrome/Edge uniquement
#   ./build.sh firefox      # Build Firefox uniquement
#   API_URL=https://api.example.com ./build.sh  # Override API_URL

set -e

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Charger les variables d'environnement depuis .env si présent
if [ -f .env ]; then
    echo -e "${BLUE}📄 Chargement de .env...${NC}"
    export $(grep -v '^#' .env | xargs)
fi

# Valeur par défaut si non définie
API_URL="${API_URL:-http://localhost:8085}"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo -e "   API_URL: ${YELLOW}${API_URL}${NC}"
echo ""

# Mettre à jour src/config.ts avec l'URL de l'API
CONFIG_FILE="src/config.ts"
echo -e "${BLUE}📝 Mise à jour de ${CONFIG_FILE}...${NC}"

cat > "$CONFIG_FILE" << EOF
// Configuration de l'extension JobMatch
// Généré automatiquement par build.sh - ne pas modifier manuellement

export const DEFAULT_API_URL = '${API_URL}';
EOF

# Fonction de build
build_chrome() {
    echo -e "${BLUE}🏗️  Build Chrome/Edge...${NC}"
    npm run build
    echo -e "${GREEN}✅ Chrome/Edge build terminé → dist/${NC}"
}

build_firefox() {
    echo -e "${BLUE}🏗️  Build Firefox...${NC}"
    npm run build:firefox
    echo -e "${GREEN}✅ Firefox build terminé → dist-firefox/${NC}"
}

# Exécution selon l'argument
case "${1:-all}" in
    chrome)
        build_chrome
        ;;
    firefox)
        build_firefox
        ;;
    all|*)
        build_chrome
        echo ""
        build_firefox
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Build terminé avec succès!${NC}"
echo ""
echo -e "Prochaines étapes:"
echo -e "  Chrome/Edge: Charger ${YELLOW}dist/${NC} dans chrome://extensions/"
echo -e "  Firefox:     Charger ${YELLOW}dist-firefox/manifest.json${NC} dans about:debugging"
