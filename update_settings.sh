#!/usr/bin/env bash
# shellcheck disable=SC1091,2148
# Neko: Update default settings to disable telemetry
# This script replaces telemetry.patch with a more robust approach

DEFAULT_TRUE="'default': true"
DEFAULT_FALSE="'default': false"
DEFAULT_ON="'default': TelemetryConfiguration.ON"
DEFAULT_OFF="'default': TelemetryConfiguration.OFF"

# include common functions
. ../utils.sh

update_setting () {
  local FILENAME SETTING LINE_NUM IN_SETTING FOUND DEFAULT_TRUE_TO_FALSE

  FILENAME="${2}"
  # check that the file exists
  if [[ ! -f "${FILENAME}" ]]; then
    echo "File to update setting in does not exist ${FILENAME}"
    return
  fi

  # go through lines of file, looking for block that contains setting
  SETTING="${1}"
  LINE_NUM=0
  IN_SETTING=0
  FOUND=0
  while read -r line; do
    LINE_NUM=$(( LINE_NUM + 1 ))
    if [[ "${line}" == *"${SETTING}"* ]]; then
      IN_SETTING=1
    fi
    if [[ ("${line}" == *"${DEFAULT_TRUE}"* || "${line}" == *"${DEFAULT_ON}"*) && "${IN_SETTING}" == "1" ]]; then
      FOUND=1
      break
    fi
  done < "${FILENAME}"

  if [[ "${FOUND}" != "1" ]]; then
    echo "${DEFAULT_TRUE} not found for setting ${SETTING} in file ${FILENAME}"
    return
  fi

  # construct line-aware replacement string
  if [[ "${line}" == *"${DEFAULT_TRUE}"* ]]; then
    DEFAULT_TRUE_TO_FALSE="${LINE_NUM}s/${DEFAULT_TRUE}/${DEFAULT_FALSE}/"
  else
    DEFAULT_TRUE_TO_FALSE="${LINE_NUM}s/${DEFAULT_ON}/${DEFAULT_OFF}/"
  fi

  replace "${DEFAULT_TRUE_TO_FALSE}" "${FILENAME}"
  echo "Updated setting ${SETTING} in ${FILENAME} at line ${LINE_NUM}"
}

# 1. Telemetry service - TelemetryConfiguration.ON -> OFF
update_setting "telemetry.telemetryLevel" src/vs/platform/telemetry/common/telemetryService.ts

# 2. Telemetry service - enableTelemetry default true -> false
update_setting "telemetry.enableTelemetry" src/vs/platform/telemetry/common/telemetryService.ts

# 3. Workbench contribution - enableNaturalLanguageSearch (command palette)
update_setting "workbench.commandPalette.experimental.enableNaturalLanguageSearch" src/vs/workbench/browser/workbench.contribution.ts

# 4. Edit telemetry contribution - experimental edit telemetry
update_setting "telemetry.experimental.editTelemetry" src/vs/workbench/contrib/editTelemetry/browser/editTelemetry.contribution.ts

# 5. Preferences contribution - natural language settings search
update_setting "workbench.settings.enableNaturalLanguageSearch" src/vs/workbench/contrib/preferences/common/preferencesContribution.ts

# 6. Desktop contribution - crash reporter (electron-sandbox for newer versions)
if [[ -f "src/vs/workbench/electron-sandbox/desktop.contribution.ts" ]]; then
  update_setting "telemetry.enableCrashReporter" src/vs/workbench/electron-sandbox/desktop.contribution.ts
elif [[ -f "src/vs/workbench/electron-browser/desktop.contribution.ts" ]]; then
  update_setting "telemetry.enableCrashReporter" src/vs/workbench/electron-browser/desktop.contribution.ts
fi

# 7. Assignment service - experiments
update_setting "workbench.enableExperiments" src/vs/workbench/services/assignment/common/assignmentService.ts
