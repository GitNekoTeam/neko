#!/usr/bin/env bash
# shellcheck disable=SC1091
# Windows packaging script for Neko
# This script is used in the two-stage build process:
# 1. Compile on Linux (compile job)
# 2. Package on Windows (this script)

set -ex

if [[ "${CI_BUILD}" != "yes" ]]; then
  echo "This script is designed for CI builds only"
  exit 1
fi

# Extract the pre-compiled vscode artifact
tar -xzf ./vscode.tar.gz

cd vscode || { echo "'vscode' dir not found"; exit 1; }

# Install npm dependencies with retry
for i in {1..5}; do
  npm ci && break
  if [[ $i == 5 ]]; then
    echo "Npm install failed too many times" >&2
    exit 1
  fi
  echo "Npm install failed $i, trying again..."
done

# Mixin npm dependencies
node build/azure-pipelines/distro/mixin-npm

# Install neko-ai extension dependencies (excluded from vscode.tar.gz)
if [[ -d "extensions/neko-ai" ]]; then
  echo "Installing neko-ai extension dependencies..."
  cd extensions/neko-ai
  npm install --production --ignore-scripts 2>/dev/null || true
  cd ../..
fi

# Generate RTF license file
. ../build/windows/rtf/make.sh

# Build the Windows package
npm run gulp "vscode-win32-${VSCODE_ARCH}-min-ci"

# CLI build disabled for initial release
# . ../build_cli.sh

# REH builds disabled for initial release
# if [[ "${VSCODE_ARCH}" == "x64" ]]; then
#   if [[ "${SHOULD_BUILD_REH}" != "no" ]]; then
#     echo "Building REH"
#     npm run gulp minify-vscode-reh
#     npm run gulp "vscode-reh-win32-${VSCODE_ARCH}-min-ci"
#   fi
#
#   if [[ "${SHOULD_BUILD_REH_WEB}" != "no" ]]; then
#     echo "Building REH-web"
#     npm run gulp minify-vscode-reh-web
#     npm run gulp "vscode-reh-web-win32-${VSCODE_ARCH}-min-ci"
#   fi
# fi

cd ..
