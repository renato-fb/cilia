-- ================================================
-- Migração: Kllix Cilia - Banco de Dados
-- Banco: kllix_cilia
-- ================================================

CREATE DATABASE IF NOT EXISTS kllix_cilia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kllix_cilia;

-- ------------------------------------------------
-- Tabela de Usuários
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS cilia_usuarios (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuário admin padrão (Aluisio)
INSERT INTO cilia_usuarios (username, password, nome_completo, role)
VALUES ('aluisio', 'cilia_admin@2026', 'Aluisio', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';

-- ------------------------------------------------
-- Tabela de Log de Importações (histórico)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS cilia_importacoes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
