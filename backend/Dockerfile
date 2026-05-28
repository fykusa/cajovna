FROM php:7.4-apache

# Potřebné PHP extensions
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Zapnout mod_rewrite pro Apache (potřeba pro API routing)
RUN a2enmod rewrite

# Apache config – povolit .htaccess
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

EXPOSE 80
