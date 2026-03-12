<?php
require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

return [
    'vhsys_access_token' => $_ENV['VHSYS_ACCESS_TOKEN'] ?? '',
    'vhsys_secret_token' => $_ENV['VHSYS_SECRET_TOKEN'] ?? '',
];
