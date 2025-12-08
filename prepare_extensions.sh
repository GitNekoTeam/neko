#!/usr/bin/env bash
# Build and prepare neko-ai extension for bundling with Neko IDE
# This script builds the neko-ai extension and copies it to the vscode extensions directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${SCRIPT_DIR}/extensions/neko-ai"
VSCODE_EXTENSIONS_DIR="${SCRIPT_DIR}/vscode/extensions"

echo "Building neko-ai extension..."

# Check if extension directory exists
if [[ ! -d "${EXTENSION_DIR}" ]]; then
    echo "Error: Extension directory not found: ${EXTENSION_DIR}"
    exit 1
fi

cd "${EXTENSION_DIR}"

# Install dependencies
echo "Installing extension dependencies..."
npm ci

# Run linting
echo "Running ESLint..."
npm run lint

# Build the extension
echo "Building extension..."
npm run compile

# Build webview UI if exists
if [[ -d "webview-ui" ]]; then
    echo "Building webview UI..."
    npm run build:webview 2>/dev/null || true
fi

# Create extension output directory in vscode
DEST_DIR="${VSCODE_EXTENSIONS_DIR}/neko-ai"
echo "Copying extension to ${DEST_DIR}..."

mkdir -p "${DEST_DIR}"

# Copy necessary files
cp -r dist "${DEST_DIR}/" 2>/dev/null || mkdir -p "${DEST_DIR}/dist"
cp -r out "${DEST_DIR}/" 2>/dev/null || true
cp package.json "${DEST_DIR}/"
cp package-lock.json "${DEST_DIR}/" 2>/dev/null || true
cp README.md "${DEST_DIR}/" 2>/dev/null || true
cp LICENSE "${DEST_DIR}/" 2>/dev/null || true

# Copy webview assets if they exist
if [[ -d "webview-ui/dist" ]]; then
    cp -r webview-ui/dist "${DEST_DIR}/webview-ui/"
fi

# Copy i18n files
if [[ -d "i18n" ]]; then
    cp -r i18n "${DEST_DIR}/"
fi

# Copy node_modules (production only)
echo "Installing production dependencies..."
cd "${DEST_DIR}"
npm ci --production 2>/dev/null || npm install --production

echo "Extension prepared successfully!"

cd "${SCRIPT_DIR}"
