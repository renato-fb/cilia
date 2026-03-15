<?php
// ============================================
// Teste de Conexão com o Banco de Dados
// Rodar via SSH: php test_db.php
// ============================================

echo "=== Teste de Conexão DB ===\n\n";

// 1. Carregar .env
require_once __DIR__ . '/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

$host = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?? '(não definido)';
$db   = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?? '(não definido)';
$user = $_ENV['DB_USER'] ?? getenv('DB_USER') ?? '(não definido)';
$pass = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?? '(não definido)';

echo "Host: $host\n";
echo "DB:   $db\n";
echo "User: $user\n";
echo "Pass: " . (strlen($pass) > 0 ? str_repeat('*', strlen($pass)) : '(vazio)') . "\n\n";

// 2. Tentar conectar
try {
    $conn = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->exec("set names utf8mb4");

    echo "✅ Conexão OK!\n\n";

    // 3. Testar query simples
    $stmt = $conn->query("SELECT COUNT(*) as total FROM cilia_usuarios");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Tabela cilia_usuarios: {$row['total']} registro(s)\n";

} catch (PDOException $e) {
    echo "❌ ERRO: " . $e->getMessage() . "\n";
}

echo "\n=== Fim do Teste ===\n";
