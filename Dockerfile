FROM php:8.3-apache

# Extensoes necessarias para SQLite
RUN docker-php-ext-install pdo pdo_sqlite

# Ajustes de Apache
RUN a2enmod rewrite headers

WORKDIR /var/www/html
COPY . /var/www/html

# Entrypoint para garantir persistencia da pasta data
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
