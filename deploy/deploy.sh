#!/bin/sh
# Redeploys the API on the VPS. CI runs it as the forced command of its SSH key, passing the commit
# to deploy as the SSH command (see README → 部署 → 自动部署):
#   command="sh /root/sodu/deploy/deploy.sh",restrict ssh-ed25519 AAAA... sudoku-ci
# Manual use on the VPS: SSH_ORIGINAL_COMMAND=<sha> sh /root/sodu/deploy/deploy.sh
#
# The body is one brace group ending in exit, so the shell has parsed all of it before git reset
# replaces this file with the new revision.
{
  set -eu
  sha=${SSH_ORIGINAL_COMMAND:-}
  case $sha in
    *[!0-9a-f]* | '')
      echo "expected a commit sha, got '$sha'" >&2
      exit 2
      ;;
  esac
  if [ ${#sha} -ne 40 ]; then
    echo "expected a full 40-character commit sha" >&2
    exit 2
  fi

  cd /root/sodu
  git fetch --quiet origin main
  # Only commits that are on main, and never one older than what is already deployed.
  git merge-base --is-ancestor "$sha" origin/main || {
    echo "$sha is not on origin/main" >&2
    exit 1
  }
  git merge-base --is-ancestor HEAD "$sha" || {
    echo "$sha is older than the deployed $(git rev-parse --short HEAD), skipping"
    exit 0
  }
  git reset --quiet --hard "$sha"
  echo "deploying $(git log -1 --format='%h %s')"

  # --wait returns once both containers report healthy, and fails the deploy otherwise.
  docker compose -f deploy/docker-compose.yml up -d --build --wait --wait-timeout 120
  docker image prune -f >/dev/null
  exit 0
}
