FROM php:7.4-apache

# Potřebné PHP extensions
RUN apt-get update && apt-get install -y libzip-dev && rm -rf /var/lib/apt/lists/*
RUN docker-php-ext-install pdo pdo_mysql mysqli zip

# Zapnout mod_rewrite pro Apache (potřeba pro API routing)
RUN a2enmod rewrite

# Apache config – povolit .htaccess
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

EXPOSE 80
