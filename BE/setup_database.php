<?php
// =============================================
// Setup do Banco de Dados - Kllix Cilia
// Rode: php setup_database.php
// =============================================

// Credenciais diretas (não depende de .env)
$host     = 'localhost';
$dbName   = 'u436052990_phm';
$dbUser   = 'u436052990_kllixerp';
$dbPass   = '!b5TfR8i&90A.q-$';

echo "--- Iniciando Setup do Banco de Dados ---\n";
echo "Host: $host\n";
echo "Banco: $dbName\n";
echo "User: $dbUser\n\n";

try {
    $conn = new PDO(
        "mysql:host=$host;dbname=$dbName",
        $dbUser,
        $dbPass
    );
    $conn->exec("set names utf8mb4");
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "[OK] Conectado ao banco de dados!\n\n";

    // 1. Criar tabela de usuarios
    echo "1. Verificando tabela cilia_usuarios... ";
    $conn->exec("CREATE TABLE IF NOT EXISTS cilia_usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nome_completo VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        empresa VARCHAR(255) DEFAULT '',
        vhsys_access_token VARCHAR(255) NULL,
        vhsys_secret_token VARCHAR(255) NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        ativo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    echo "OK!\n";

    // 2. Garantir colunas VHSYS (caso tabela ja exista sem elas)
    echo "2. Garantindo colunas VHSYS... ";
    try {
        $conn->exec("ALTER TABLE cilia_usuarios ADD COLUMN vhsys_access_token VARCHAR(255) NULL AFTER empresa;");
    } catch (PDOException $e) { /* ja existe */ }
    try {
        $conn->exec("ALTER TABLE cilia_usuarios ADD COLUMN vhsys_secret_token VARCHAR(255) NULL AFTER vhsys_access_token;");
    } catch (PDOException $e) { /* ja existe */ }
    echo "OK!\n";

    // 3. Criar tabela de importacoes
    echo "3. Verificando tabela cilia_importacoes... ";
    $conn->exec("CREATE TABLE IF NOT EXISTS cilia_importacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nome_arquivo VARCHAR(255) NOT NULL,
        seguradora VARCHAR(255) DEFAULT '',
        placa VARCHAR(20) DEFAULT '',
        cliente_nome VARCHAR(255) DEFAULT '',
        vhsys_os_id INT DEFAULT NULL,
        tipos_importados VARCHAR(255) DEFAULT '',
        total_itens INT DEFAULT 0,
        valor_total DECIMAL(12,2) DEFAULT 0.00,
        status ENUM('sucesso', 'erro', 'pendente') DEFAULT 'pendente',
        erro_mensagem TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES cilia_usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    echo "OK!\n";

    // 4. Criar admin padrao
    echo "4. Verificando usuario admin... ";
    $stmt = $conn->query("SELECT COUNT(*) FROM cilia_usuarios WHERE username = 'aluisio'");
    if ($stmt->fetchColumn() == 0) {
        $conn->exec("INSERT INTO cilia_usuarios (username, password, nome_completo, role) 
                      VALUES ('aluisio', 'cilia_admin@2026', 'Aluisio', 'admin')");
        echo "Usuario 'aluisio' criado!\n";
    } else {
        echo "Admin ja existe.\n";
    }

    echo "\n--- Setup concluido com sucesso! ---\n";

} catch (PDOException $e) {
    echo "\n[ERRO] " . $e->getMessage() . "\n";
    exit(1);
}
