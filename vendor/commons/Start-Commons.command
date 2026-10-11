#!/bin/bash
# Copyright 2026 Leland Jourdan II / C&L Strategy
# SPDX-License-Identifier: Apache-2.0
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer, then run this file again."
  read -r -p "Press Return to close." reply
  exit 2
fi
node bin/cosmic.mjs serve
