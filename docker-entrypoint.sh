#!/usr/bin/env sh
set -eu

# Se existir disco montado em /var/data, usa para persistir o SQLite.
if [ -d "/var/data" ]; then
  mkdir -p /var/data/app-data
  if [ -L "/var/www/html/data" ] || [ -d "/var/www/html/data" ]; then
    rm -rf /var/www/html/data
  fi
  ln -s /var/data/app-data /var/www/html/data
fi

exec "$@"
