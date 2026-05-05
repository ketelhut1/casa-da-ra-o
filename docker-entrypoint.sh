#!/usr/bin/env sh
set -eu

# Se existir disco montado em /var/data, usa para persistir o SQLite.
if [ -d "/var/data" ]; then
  mkdir -p /var/data/app-data
  # Garante que o Apache (www-data) consiga criar/atualizar o SQLite.
  chown -R www-data:www-data /var/data/app-data
  chmod -R ug+rwX /var/data/app-data
  if [ -L "/var/www/html/data" ] || [ -d "/var/www/html/data" ]; then
    rm -rf /var/www/html/data
  fi
  ln -s /var/data/app-data /var/www/html/data
fi

exec "$@"
