#!/usr/bin/env bash
# Build and prepare neko-ai extension for bundling with Neko IDE
# This script builds the neko-ai extension and copies it to the vscode extensions directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${SCRIPT_DIR}/extensions/neko-ai"
VSCODE_DIR="${SCRIPT_DIR}/vscode"
VSCODE_EXTENSIONS_DIR="${VSCODE_DIR}/extensions"

echo "Building neko-ai extension..."

# Check if extension directory exists
if [[ ! -d "${EXTENSION_DIR}" ]]; then
    echo "Error: Extension directory not found: ${EXTENSION_DIR}"
    exit 1
fi

# Check if vscode directory exists
if [[ ! -d "${VSCODE_DIR}" ]]; then
    echo "Error: VSCode directory not found: ${VSCODE_DIR}"
    exit 1
fi

cd "${EXTENSION_DIR}"

# Install dependencies
echo "Installing extension dependencies..."
if [[ -f "package-lock.json" ]]; then
    npm ci
else
    echo "No package-lock.json found, running npm install..."
    npm install
fi

# Run linting
echo "Running ESLint..."
npm run lint || true

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

rm -rf "${DEST_DIR}"
mkdir -p "${DEST_DIR}"

# Copy necessary files
cp -r dist "${DEST_DIR}/" 2>/dev/null || mkdir -p "${DEST_DIR}/dist"
cp -r out "${DEST_DIR}/" 2>/dev/null || true
cp -r src "${DEST_DIR}/" 2>/dev/null || true
cp package.json "${DEST_DIR}/"
cp tsconfig.json "${DEST_DIR}/"
cp README.md "${DEST_DIR}/" 2>/dev/null || true
cp LICENSE "${DEST_DIR}/" 2>/dev/null || true

# Copy webview assets if they exist
if [[ -d "webview-ui/dist" ]]; then
    mkdir -p "${DEST_DIR}/webview-ui"
    cp -r webview-ui/dist "${DEST_DIR}/webview-ui/"
fi

# Copy i18n files
if [[ -d "src/i18n" ]]; then
    mkdir -p "${DEST_DIR}/src"
    cp -r src/i18n "${DEST_DIR}/src/"
fi

# Install production dependencies
echo "Installing production dependencies..."
cd "${DEST_DIR}"
npm install --production --ignore-scripts 2>/dev/null || true

# Add neko-ai to VSCode build compilations
echo "Adding neko-ai to VSCode build system..."
cd "${VSCODE_DIR}"

# Source utils.sh for cross-platform sed
if [[ -f "../utils.sh" ]]; then
    . ../utils.sh
fi

GULPFILE="build/gulpfile.extensions.js"
if [[ -f "${GULPFILE}" ]]; then
    # Check if neko-ai is already in the compilations
    if ! grep -q "neko-ai/tsconfig.json" "${GULPFILE}"; then
        echo "Patching ${GULPFILE}..."
        # Find the line with vscode-colorize-tests and add neko-ai after it
        if grep -q "vscode-colorize-tests/tsconfig.json" "${GULPFILE}"; then
            # Use cross-platform replace function from utils.sh
            if type -t replace &> /dev/null; then
                replace "/vscode-colorize-tests\/tsconfig.json/a\\        'extensions\/neko-ai\/tsconfig.json'," "${GULPFILE}"
            else
                # Fallback to platform-specific sed
                if [[ "${OS_NAME}" == "windows" ]] || sed --version &> /dev/null; then
                    sed -i "/vscode-colorize-tests\/tsconfig.json/a\\        'extensions/neko-ai/tsconfig.json'," "${GULPFILE}"
                else
                    sed -i '' "/vscode-colorize-tests\/tsconfig.json/a\\        'extensions/neko-ai/tsconfig.json'," "${GULPFILE}"
                fi
            fi
            echo "Added neko-ai to compilations"
        else
            echo "Warning: Could not find insertion point in ${GULPFILE}"
        fi
    else
        echo "neko-ai already in compilations"
    fi
fi

echo "Extension prepared successfully!"

cd "${SCRIPT_DIR}"
