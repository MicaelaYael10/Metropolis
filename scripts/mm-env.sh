#!/bin/sh
# usage: source scripts/mm-env.sh
# Puts the MetaMask Agent Wallet CLI (mm) on PATH.
# NixOS-friendly: global npm installs fail because npm's default prefix is a
# read-only nix-store path, so mm is installed under a writable prefix instead.

if ! command -v mm >/dev/null 2>&1; then
  if [ -x "$HOME/.local/bin/mm" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  elif [ -x /tmp/opencode/mm-sdk/node_modules/.bin/mm ]; then
    export PATH="/tmp/opencode/mm-sdk/node_modules/.bin:$PATH"
  fi
fi

if command -v mm >/dev/null 2>&1; then
  printf 'mm ready: %s\n' "$(command -v mm)"
else
  printf 'mm not found. Install it:\n  npm install -g --prefix "$HOME/.local" @metamask/agent-wallet\n'
fi