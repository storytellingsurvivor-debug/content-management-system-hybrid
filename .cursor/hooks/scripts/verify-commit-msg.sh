#!/usr/bin/env bash
set -euo pipefail

msg_file="${1:-}"

if [[ -z "${msg_file}" || ! -f "${msg_file}" ]]; then
  echo "Commit message file is missing."
  exit 1
fi

first_line="$(awk 'NF { print; exit }' "${msg_file}")"

if [[ -z "${first_line}" ]]; then
  echo "Commit message cannot be empty."
  exit 1
fi

if [[ "${#first_line}" -lt 10 ]]; then
  echo "Commit message title is too short. Use a meaningful summary."
  exit 1
fi

if [[ "${#first_line}" -gt 72 ]]; then
  echo "Commit message title should be 72 characters or less."
  exit 1
fi
