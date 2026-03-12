<?php
require_once 'database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    echo "Adicionando colunas vhsys_access_token e vhsys_secret_token...\n";
    
    // Add columns if they don't exist
    $sql = "ALTER TABLE cilia_usuarios 
            ADD COLUMN vhsys_access_token VARCHAR(255) NULL AFTER empresa,
            ADD COLUMN vhsys_secret_token VARCHAR(255) NULL AFTER vhsys_access_token;";
            
    $conn->exec($sql);
    echo "Colunas adicionadas com sucesso!\n";

} catch (PDOException $e) {
    // If error is 1060 it means duplicate column name, which is fine
    if ($e->getCode() == '42S21') {
        echo "As colunas ja existem no banco de dados.\n";
    } else {
        echo "Erro ao rodar migracao: " . $e->getMessage() . "\n";
    }
}
