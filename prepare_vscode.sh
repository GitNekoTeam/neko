#!/usr/bin/env bash
# shellcheck disable=SC1091,2154

set -e

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  cp -rp src/insider/* vscode/
else
  cp -rp src/stable/* vscode/
fi

cp -f LICENSE vscode/LICENSE.txt

cd vscode || { echo "'vscode' dir not found"; exit 1; }

# Neko: Update default settings to disable telemetry
../update_settings.sh

{ set +x; } 2>/dev/null

# {{{ product.json
cp product.json{,.bak}

setpath() {
  local jsonTmp
  { set +x; } 2>/dev/null
  jsonTmp=$( jq --arg 'value' "${3}" "setpath(path(.${2}); \$value)" "${1}.json" )
  echo "${jsonTmp}" > "${1}.json"
  set -x
}

setpath_json() {
  local jsonTmp
  { set +x; } 2>/dev/null
  jsonTmp=$( jq --argjson 'value' "${3}" "setpath(path(.${2}); \$value)" "${1}.json" )
  echo "${jsonTmp}" > "${1}.json"
  set -x
}

setpath "product" "checksumFailMoreInfoUrl" "https://gitneko.com/editor/checksum"
setpath "product" "documentationUrl" "https://gitneko.com/editor/docs"
setpath_json "product" "extensionsGallery" '{"serviceUrl": "https://open-vsx.org/vscode/gallery", "itemUrl": "https://open-vsx.org/vscode/item", "latestUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest", "controlUrl": "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json"}'

setpath "product" "introductoryVideosUrl" "https://gitneko.com/editor/videos"
setpath "product" "keyboardShortcutsUrlLinux" "https://gitneko.com/editor/shortcuts/linux"
setpath "product" "keyboardShortcutsUrlMac" "https://gitneko.com/editor/shortcuts/mac"
setpath "product" "keyboardShortcutsUrlWin" "https://gitneko.com/editor/shortcuts/windows"
setpath "product" "licenseUrl" "https://github.com/GitNekoTeam/neko/blob/main/LICENSE"
setpath_json "product" "linkProtectionTrustedDomains" '["https://open-vsx.org", "https://gitneko.com"]'
setpath "product" "releaseNotesUrl" "https://gitneko.com/editor/releases"
setpath "product" "reportIssueUrl" "https://github.com/GitNekoTeam/neko/issues/new"
setpath "product" "requestFeatureUrl" "https://github.com/GitNekoTeam/neko/issues/new?labels=feature-request"
setpath "product" "tipsAndTricksUrl" "https://gitneko.com/editor/tips"
setpath "product" "twitterUrl" "https://gitneko.com"

if [[ "${DISABLE_UPDATE}" != "yes" ]]; then
  setpath "product" "updateUrl" "https://raw.githubusercontent.com/GitNekoTeam/versions/refs/heads/main"
  setpath "product" "downloadUrl" "https://gitneko.com/editor/download"
fi

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  setpath "product" "nameShort" "Neko - Insiders"
  setpath "product" "nameLong" "Neko - Insiders"
  setpath "product" "applicationName" "neko-insiders"
  setpath "product" "dataFolderName" ".neko-insiders"
  setpath "product" "linuxIconName" "neko-insiders"
  setpath "product" "quality" "insider"
  setpath "product" "urlProtocol" "neko-insiders"
  setpath "product" "serverApplicationName" "neko-server-insiders"
  setpath "product" "serverDataFolderName" ".neko-server-insiders"
  setpath "product" "darwinBundleIdentifier" "com.gitneko.NekoInsiders"
  setpath "product" "win32AppUserModelId" "GitNeko.NekoInsiders"
  setpath "product" "win32DirName" "Neko Insiders"
  setpath "product" "win32MutexName" "nekoinsiders"
  setpath "product" "win32NameVersion" "Neko Insiders"
  setpath "product" "win32RegValueName" "NekoInsiders"
  setpath "product" "win32ShellNameShort" "Neko Insiders"
  setpath "product" "win32AppId" "{{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"
  setpath "product" "win32x64AppId" "{{B2C3D4E5-F6A7-8901-BCDE-F12345678901}"
  setpath "product" "win32arm64AppId" "{{C3D4E5F6-A7B8-9012-CDEF-123456789012}"
  setpath "product" "win32UserAppId" "{{D4E5F6A7-B8C9-0123-DEF0-234567890123}"
  setpath "product" "win32x64UserAppId" "{{E5F6A7B8-C9D0-1234-EF01-345678901234}"
  setpath "product" "win32arm64UserAppId" "{{F6A7B8C9-D0E1-2345-F012-456789012345}"
  setpath "product" "tunnelApplicationName" "neko-insiders-tunnel"
  setpath "product" "win32TunnelServiceMutex" "nekoinsiders-tunnelservice"
  setpath "product" "win32TunnelMutex" "nekoinsiders-tunnel"
  setpath "product" "win32ContextMenu.x64.clsid" "A1B2C3D4-E5F6-7890-ABCD-EF1234567891"
  setpath "product" "win32ContextMenu.arm64.clsid" "B2C3D4E5-F6A7-8901-BCDE-F12345678902"
else
  setpath "product" "nameShort" "Neko"
  setpath "product" "nameLong" "Neko"
  setpath "product" "applicationName" "neko"
  setpath "product" "dataFolderName" ".neko"
  setpath "product" "linuxIconName" "neko"
  setpath "product" "quality" "stable"
  setpath "product" "urlProtocol" "neko"
  setpath "product" "serverApplicationName" "neko-server"
  setpath "product" "serverDataFolderName" ".neko-server"
  setpath "product" "darwinBundleIdentifier" "com.gitneko.Neko"
  setpath "product" "win32AppUserModelId" "GitNeko.Neko"
  setpath "product" "win32DirName" "Neko"
  setpath "product" "win32MutexName" "neko"
  setpath "product" "win32NameVersion" "Neko"
  setpath "product" "win32RegValueName" "Neko"
  setpath "product" "win32ShellNameShort" "Neko"
  setpath "product" "win32AppId" "{{11111111-2222-3333-4444-555555555555}"
  setpath "product" "win32x64AppId" "{{22222222-3333-4444-5555-666666666666}"
  setpath "product" "win32arm64AppId" "{{33333333-4444-5555-6666-777777777777}"
  setpath "product" "win32UserAppId" "{{44444444-5555-6666-7777-888888888888}"
  setpath "product" "win32x64UserAppId" "{{55555555-6666-7777-8888-999999999999}"
  setpath "product" "win32arm64UserAppId" "{{66666666-7777-8888-9999-AAAAAAAAAAAA}"
  setpath "product" "tunnelApplicationName" "neko-tunnel"
  setpath "product" "win32TunnelServiceMutex" "neko-tunnelservice"
  setpath "product" "win32TunnelMutex" "neko-tunnel"
  setpath "product" "win32ContextMenu.x64.clsid" "77777777-8888-9999-AAAA-BBBBBBBBBBBB"
  setpath "product" "win32ContextMenu.arm64.clsid" "88888888-9999-AAAA-BBBB-CCCCCCCCCCCC"
fi

setpath_json "product" "tunnelApplicationConfig" '{}'

jsonTmp=$( jq -s '.[0] * .[1]' product.json ../product.json )
echo "${jsonTmp}" > product.json && unset jsonTmp

cat product.json
# }}}

# include common functions
. ../utils.sh

# {{{ apply patches

echo "APP_NAME=\"${APP_NAME}\""
echo "APP_NAME_LC=\"${APP_NAME_LC}\""
echo "BINARY_NAME=\"${BINARY_NAME}\""
echo "GH_REPO_PATH=\"${GH_REPO_PATH}\""
echo "ORG_NAME=\"${ORG_NAME}\""
echo "TUNNEL_APP_NAME=\"${TUNNEL_APP_NAME}\""

if [[ "${DISABLE_UPDATE}" == "yes" ]]; then
  mv ../patches/disable-update.patch.yet ../patches/disable-update.patch
fi

for file in ../patches/*.patch; do
  if [[ -f "${file}" ]]; then
    apply_patch "${file}"
  fi
done

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  for file in ../patches/insider/*.patch; do
    if [[ -f "${file}" ]]; then
      apply_patch "${file}"
    fi
  done
fi

if [[ -d "../patches/${OS_NAME}/" ]]; then
  for file in "../patches/${OS_NAME}/"*.patch; do
    if [[ -f "${file}" ]]; then
      apply_patch "${file}"
    fi
  done
fi

for file in ../patches/user/*.patch; do
  if [[ -f "${file}" ]]; then
    apply_patch "${file}"
  fi
done
# }}}

set -x

# {{{ install dependencies
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

if [[ "${OS_NAME}" == "linux" ]]; then
  export VSCODE_SKIP_NODE_VERSION_CHECK=1

   if [[ "${npm_config_arch}" == "arm" ]]; then
    export npm_config_arm_version=7
  fi
elif [[ "${OS_NAME}" == "windows" ]]; then
  if [[ "${npm_config_arch}" == "arm" ]]; then
    export npm_config_arm_version=7
  fi
else
  if [[ "${CI_BUILD}" != "no" ]]; then
    clang++ --version
  fi
fi

mv .npmrc .npmrc.bak
cp ../npmrc .npmrc

for i in {1..5}; do # try 5 times
  if [[ "${CI_BUILD}" != "no" && "${OS_NAME}" == "osx" ]]; then
    CXX=clang++ npm ci && break
  else
    npm ci && break
  fi

  if [[ $i == 5 ]]; then
    echo "Npm install failed too many times" >&2
    exit 1
  fi
  echo "Npm install failed $i, trying again..."

  sleep $(( 15 * (i + 1)))
done

mv .npmrc.bak .npmrc
# }}}

# package.json
cp package.json{,.bak}

setpath "package" "version" "${RELEASE_VERSION%-insider}"

replace 's|Microsoft Corporation|GitNeko Team|' package.json

cp resources/server/manifest.json{,.bak}

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  setpath "resources/server/manifest" "name" "Neko - Insiders"
  setpath "resources/server/manifest" "short_name" "Neko - Insiders"
else
  setpath "resources/server/manifest" "name" "Neko"
  setpath "resources/server/manifest" "short_name" "Neko"
fi

# announcements
replace "s|\\[\\/\\* BUILTIN_ANNOUNCEMENTS \\*\\/\\]|$( tr -d '\n' < ../announcements-builtin.json )|" src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts

../undo_telemetry.sh

replace 's|Microsoft Corporation|GitNeko Team|' build/lib/electron.js
replace 's|Microsoft Corporation|GitNeko Team|' build/lib/electron.ts
replace 's|([0-9]) Microsoft|\1 GitNeko|' build/lib/electron.js
replace 's|([0-9]) Microsoft|\1 GitNeko|' build/lib/electron.ts

if [[ "${OS_NAME}" == "linux" ]]; then
  if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
    sed -i "s/code-oss/neko-insiders/" resources/linux/debian/postinst.template
  else
    sed -i "s/code-oss/neko/" resources/linux/debian/postinst.template
  fi

  # fix the packages metadata
  # code.appdata.xml
  sed -i 's|Visual Studio Code|Neko|g' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://gitneko.com/editor/download|' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com/home/home-screenshot-linux-lg.png|https://gitneko.com/img/neko.png|' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com|https://gitneko.com|' resources/linux/code.appdata.xml

  # control.template
  sed -i 's|Microsoft Corporation <vscode-linux@microsoft.com>|GitNeko Team https://github.com/GitNekoTeam/neko/graphs/contributors|'  resources/linux/debian/control.template
  sed -i 's|Visual Studio Code|Neko|g' resources/linux/debian/control.template
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://gitneko.com/editor/download|' resources/linux/debian/control.template
  sed -i 's|https://code.visualstudio.com|https://gitneko.com|' resources/linux/debian/control.template

  # code.spec.template
  sed -i 's|Microsoft Corporation|GitNeko Team|' resources/linux/rpm/code.spec.template
  sed -i 's|Visual Studio Code Team <vscode-linux@microsoft.com>|GitNeko Team https://github.com/GitNekoTeam/neko/graphs/contributors|' resources/linux/rpm/code.spec.template
  sed -i 's|Visual Studio Code|Neko|' resources/linux/rpm/code.spec.template
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://gitneko.com/editor/download|' resources/linux/rpm/code.spec.template
  sed -i 's|https://code.visualstudio.com|https://gitneko.com|' resources/linux/rpm/code.spec.template

  # snapcraft.yaml
  sed -i 's|Visual Studio Code|Neko|'  resources/linux/rpm/code.spec.template
elif [[ "${OS_NAME}" == "windows" ]]; then
  # code.iss
  sed -i 's|https://code.visualstudio.com|https://gitneko.com|' build/win32/code.iss
  sed -i 's|Microsoft Corporation|GitNeko Team|' build/win32/code.iss
fi

cd ..

# Build and prepare neko-ai extension
echo "Preparing neko-ai extension..."
if [[ -f "./prepare_extensions.sh" ]]; then
    chmod +x ./prepare_extensions.sh
    ./prepare_extensions.sh
fi
