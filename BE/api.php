<?php
// ============================================
// Kllix Cilia - API Principal
// ============================================
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

// CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$config = require 'config.php';

$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? null;
$method = $_SERVER['REQUEST_METHOD'];

// VHSYS Config Base
$baseUrl = 'https://api.vhsys.com.br/v2';

// Helper: Get headers for specific user, fallback to config.php global keys
function getVhsysHeaders($conn, $user_id, $config) {
    $access = $config['vhsys_access_token'] ?? '';
    $secret = $config['vhsys_secret_token'] ?? '';

    if ($user_id) {
        $stmt = $conn->prepare("SELECT vhsys_access_token, vhsys_secret_token FROM cilia_usuarios WHERE id = :id AND ativo = 1");
        $stmt->bindParam(':id', $user_id);
        $stmt->execute();
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($userData && !empty($userData['vhsys_access_token']) && !empty($userData['vhsys_secret_token'])) {
            $access = $userData['vhsys_access_token'];
            $secret = $userData['vhsys_secret_token'];
        }
    }

    return [
        'access-token: ' . $access,
        'secret-access-token: ' . $secret,
        'Content-Type: application/json',
        'User-Agent: KllixCilia/1.0'
    ];
}

// ============================================
// Helper: cURL Request
// ============================================
function makeRequest($url, $headers, $method = 'GET', $data = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        return json_encode(['error' => curl_error($ch)]);
    }
    curl_close($ch);
    return $response;
}

// ============================================
// Helper: Buscar produto existente no VHSYS por descrição
// ============================================
function buscarProdutoPorDescricao($baseUrl, $headers, $descricao) {
    $url = $baseUrl . '/produtos?desc_produto=' . urlencode($descricao);
    $response = makeRequest($url, $headers, 'GET');
    $data = json_decode($response, true);

    if (isset($data['code']) && $data['code'] == 200 && !empty($data['data'])) {
        // A API retorna uma lista, procurar match exato (case-insensitive)
        foreach ($data['data'] as $produto) {
            if (isset($produto['desc_produto']) && mb_strtolower(trim($produto['desc_produto'])) === mb_strtolower(trim($descricao))) {
                return $produto['id_produto'];
            }
        }
    }
    return null;
}

// ============================================
// Helper: Cadastrar produto no VHSYS
// ============================================
function cadastrarProduto($baseUrl, $headers, $item) {
    $desc = $item['nome'] ? mb_substr($item['nome'], 0, 255) : 'Produto Avulso';
    $codigo = $item['codigo'] ?? '';
    $valor = floatval($item['valor_peca'] ?? 0);

    $payload = [
        'id_categoria' => 0,
        'cod_produto' => $codigo ?: '0',
        'marca_produto' => '',
        'desc_produto' => $desc,
        'fornecedor_produto' => '',
        'fornecedor_produto_id' => 0,
        'minimo_produto' => '0.00',
        'maximo_produto' => '0.00',
        'estoque_produto' => '0.00',
        'unidade_produto' => 'UN',
        'valor_produto' => number_format($valor, 2, '.', ''),
        'valor_custo_produto' => number_format($valor, 2, '.', ''),
        'peso_produto' => '0.00',
        'peso_liq_produto' => '0.00',
        'icms_produto' => '0.00',
        'ipi_produto' => '0.00',
        'pis_produto' => '0.00',
        'cofins_produto' => '0.00',
        'cest_produto' => '',
        'ncm_produto' => '',
        'codigo_barra_produto' => '',
        'obs_produto' => '',
        'tipo_produto' => 'Produto',
        'kit_produto' => 'Nao',
        'status_produto' => 'Ativo',
        'produto_variado' => false,
    ];

    $url = $baseUrl . '/produtos';
    $response = makeRequest($url, $headers, 'POST', $payload);
    $data = json_decode($response, true);

    if (isset($data['code']) && $data['code'] == 200 && isset($data['data']['id_produto'])) {
        return $data['data']['id_produto'];
    }
    return null;
}

// ============================================
// Helper: Construir tipo de serviço a partir das flags do item
// ============================================
function buildTipoServico($item) {
    $troca = filter_var($item['troca'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $ri = filter_var($item['remocao_instalacao'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $rep = filter_var($item['reparacao'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $pin = filter_var($item['pintura'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $nome = trim($item['nome'] ?? '');

    $partes = [];

    // Remoção/Instalação ou Troca
    if ($troca || $ri) {
        $partes[] = 'REM, INST';
    }

    // Reparação
    if ($rep) {
        $partes[] = 'REPARAÇÃO';
    }

    // Pintura
    if ($pin) {
        $partes[] = 'PINTURA';
    }

    if (empty($partes)) {
        return $nome;
    }

    $tipo = implode(' E ', $partes);
    return $nome ? ($tipo . ' ' . $nome) : $tipo;
}

// ============================================
// Helper: Check admin role
// ============================================
function isAdmin($conn, $user_id) {
    $stmt = $conn->prepare("SELECT role FROM cilia_usuarios WHERE id = :id AND ativo = 1");
    $stmt->bindParam(':id', $user_id);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    return $user && $user['role'] === 'admin';
}

// ============================================
// Database connection
// ============================================
$db = new Database();
$conn = $db->getConnection();

// ============================================
// ACTION: Login
// ============================================
// ============================================
// ACTION: Verify VHSYS Credentials
// ============================================
if ($action === 'verificar_vhsys') {
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'User ID missing']);
        exit;
    }

    $headers = getVhsysHeaders($conn, $user_id, $config);
    // Use /clientes as a status check (it's safe and usually fast)
    $url = $baseUrl . '/clientes?limit=1'; 
    $response = makeRequest($url, $headers, 'GET');
    $responseData = json_decode($response, true);

    if (isset($responseData['code']) && $responseData['code'] == 200) {
        echo json_encode(['status' => 'success', 'valid' => true]);
    } else {
        echo json_encode(['status' => 'error', 'valid' => false, 'details' => $responseData]);
    }
    exit;
}

if ($action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $user = $input['username'] ?? '';
    $pass = $input['password'] ?? '';

    $stmt = $conn->prepare("SELECT id, username, nome_completo, role FROM cilia_usuarios WHERE username = :user AND password = :pass AND ativo = 1");
    $stmt->bindParam(':user', $user);
    $stmt->bindParam(':pass', $pass);
    $stmt->execute();
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($userData) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Login realizado com sucesso',
            'user_id' => $userData['id'],
            'username' => $userData['username'],
            'nome_completo' => $userData['nome_completo'],
            'role' => $userData['role']
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Usuario ou senha incorretos']);
    }
    exit;
}

// ============================================
// ACTION: Perfil
// ============================================
if ($action === 'perfil') {
    $user_id = $_GET['user_id'] ?? null;

    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'user_id obrigatorio']);
        exit;
    }

    if ($method === 'GET') {
        $stmt = $conn->prepare("SELECT id, username, nome_completo, email, empresa, role, vhsys_access_token, vhsys_secret_token FROM cilia_usuarios WHERE id = :id AND ativo = 1");
        $stmt->bindParam(':id', $user_id);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        // Don't send the full secret token back for security if desired, but since they edit it, we might need to send it or blank it.
        // We'll send it blank if it exists so they know they have one configured, or send it fully.
        if ($user && $user['vhsys_secret_token']) {
            $user['vhsys_secret_token'] = '********';
        }
        $user['has_vhsys_keys'] = !empty($user['vhsys_access_token']);
        echo json_encode($user ?: []);
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        $current_pass = $data['current_password'] ?? '';
        $new_pass = $data['new_password'] ?? '';
        $vhsys_access = $data['vhsys_access_token'] ?? null;
        $vhsys_secret = $data['vhsys_secret_token'] ?? null;

        if (!empty($current_pass) && !empty($new_pass)) {
            $stmt = $conn->prepare("SELECT id FROM cilia_usuarios WHERE id = :id AND password = :pass");
            $stmt->bindParam(':id', $user_id);
            $stmt->bindParam(':pass', $current_pass);
            $stmt->execute();

            if ($stmt->fetch()) {
                $stmt = $conn->prepare("UPDATE cilia_usuarios SET password = :pass WHERE id = :id");
                $stmt->bindParam(':pass', $new_pass);
                $stmt->bindParam(':id', $user_id);
                $stmt->execute();
            } else {
                http_response_code(401);
                echo json_encode(['status' => 'error', 'message' => 'Senha atual incorreta']);
                exit;
            }
        }

        // Update tokens if provided
        if ($vhsys_access !== null || $vhsys_secret !== null) {
            $updates = [];
            $params = [':id' => $user_id];
            if ($vhsys_access !== null) { $updates[] = "vhsys_access_token = :access"; $params[':access'] = $vhsys_access; }
            if ($vhsys_secret !== null && $vhsys_secret !== '********' && $vhsys_secret !== '') { 
                $updates[] = "vhsys_secret_token = :secret"; 
                $params[':secret'] = $vhsys_secret; 
            }
            if (!empty($updates)) {
                $sql = "UPDATE cilia_usuarios SET " . implode(', ', $updates) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Perfil atualizado com sucesso']);
    }
    exit;
}

// ============================================
// ACTION: Upload e Parse XML
// ============================================
if ($action === 'parse_xml') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    // Accept XML from file upload
    if (!isset($_FILES['xml_file']) || $_FILES['xml_file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Arquivo XML nao enviado ou com erro']);
        exit;
    }

    $xmlContent = file_get_contents($_FILES['xml_file']['tmp_name']);
    $xml = simplexml_load_string($xmlContent);

    if ($xml === false) {
        http_response_code(400);
        echo json_encode(['error' => 'XML invalido']);
        exit;
    }

    // Extract main data
    $seguradora = (string)($xml->seguradora->nome ?? '');
    $placa = (string)($xml->veiculo->placa ?? '');
    $numero_orcamento = (string)($xml->numero_orcamento ?? '');
    $numero_sinistro = (string)($xml->numero_sinistro ?? '');

    // Cliente data
    $cliente = [
        'nome' => (string)($xml->cliente->nome ?? ''),
        'email' => (string)($xml->cliente->email ?? ''),
        'cpf' => (string)($xml->cliente->cpf ?? ''),
        'telefone' => trim((string)($xml->cliente->telefone->ddd ?? '')) . (string)($xml->cliente->telefone->numero ?? ''),
        'endereco' => trim(
            (string)($xml->cliente->endereco->logradouro ?? '') . ' ' .
            (string)($xml->cliente->endereco->numero ?? '') . ', ' .
            (string)($xml->cliente->endereco->bairro ?? '') . ' - ' .
            (string)($xml->cliente->endereco->cidade ?? '') . '/' .
            (string)($xml->cliente->endereco->uf ?? '') . ' CEP: ' .
            (string)($xml->cliente->endereco->cep ?? '')
        )
    ];

    // Veiculo data
    $veiculo = [
        'nome' => (string)($xml->veiculo->nome_veiculo ?? ''),
        'marca' => (string)($xml->veiculo->marca ?? ''),
        'modelo' => (string)($xml->veiculo->modelo ?? ''),
        'placa' => $placa,
        'cor' => (string)($xml->veiculo->cor ?? ''),
        'chassi' => (string)($xml->veiculo->chassi ?? ''),
        'quilometragem' => (string)($xml->veiculo->quilometragem ?? ''),
    ];

    // Mao de obra values
    $valor_hora_mdo = floatval($xml->padrao_mao_de_obra->valor_hora_mao_de_obra ?? 0);
    $valor_hora_rep = floatval($xml->padrao_mao_de_obra->valor_hora_reparacao ?? 0);
    $valor_hora_pin = floatval($xml->padrao_mao_de_obra->valor_hora_pintura ?? 0);

    // Parse items
    $itens = [];
    $totais = ['oficina' => 0, 'seguradora' => 0, 'servico' => 0];

    if (isset($xml->itens_orcamento->item)) {
        foreach ($xml->itens_orcamento->item as $item) {
            $fornecimento = trim((string)($item->fornecimento ?? ''));
            $nome = (string)($item->nome ?? '');
            $codigo = (string)($item->codigo ?? '');
            $preco = floatval($item->preco ?? 0);
            $preco_liquido = floatval($item->preco_liquido ?? 0);
            $quantidade = intval($item->quantidade ?? 1);
            $hora_ri = floatval($item->hora_remocao_instalacao ?? 0);
            $hora_rep = floatval($item->hora_reparacao ?? 0);
            $hora_pin = floatval($item->hora_pintura ?? 0);
            $tipo_item = (string)($item->tipo_item ?? '');
            $tipo_peca = (string)($item->tipo_peca ?? '');
            $comentario = (string)($item->comentario ?? '');
            $troca = (string)($item->troca ?? 'false') === 'true';
            $remocao_instalacao = (string)($item->remocao_instalacao ?? 'false') === 'true';
            $reparacao = (string)($item->reparacao ?? 'false') === 'true';
            $pintura = (string)($item->pintura ?? 'false') === 'true';

            // Calculate values
            $valor_peca = $preco_liquido > 0 ? $preco_liquido : $preco;
            $valor_mdo_ri = $hora_ri * $valor_hora_mdo;
            $valor_mdo_rep = $hora_rep * $valor_hora_rep;
            $valor_mdo_pin = $hora_pin * $valor_hora_pin;
            $valor_mdo_total = $valor_mdo_ri + $valor_mdo_rep + $valor_mdo_pin;

            if (strtolower($tipo_item) === 'serviço' || (empty($fornecimento) && empty($tipo_item)) || ($valor_peca == 0 && $valor_mdo_total > 0)) {
                $categoria = 'servico';
                if ($valor_peca > 0 && $valor_mdo_total == 0) {
                    $valor_mdo_total = $valor_peca; // Se for um serviço manual lançado só com preco preenchido
                    $valor_peca = 0;
                }
            } else {
                // Determine category for parts
                $categoria = 'servico'; // default fallback
                if (strtolower($fornecimento) === 'oficina') {
                    $categoria = 'oficina';
                } elseif (strtolower($fornecimento) === 'seguradora') {
                    $categoria = 'seguradora';
                }
            }

            $parsed = [
                'nome' => $nome,
                'codigo' => $codigo,
                'tipo_item' => $tipo_item,
                'tipo_peca' => $tipo_peca,
                'comentario' => $comentario,
                'fornecimento' => $fornecimento,
                'categoria' => $categoria,
                'troca' => $troca,
                'remocao_instalacao' => $remocao_instalacao,
                'reparacao' => $reparacao,
                'pintura' => $pintura,
                'preco' => $preco,
                'preco_liquido' => $preco_liquido,
                'quantidade' => $quantidade,
                'hora_ri' => $hora_ri,
                'hora_reparacao' => $hora_rep,
                'hora_pintura' => $hora_pin,
                'valor_peca' => $valor_peca,
                'valor_mdo_ri' => $valor_mdo_ri,
                'valor_mdo_reparacao' => $valor_mdo_rep,
                'valor_mdo_pintura' => $valor_mdo_pin,
                'valor_mdo_total' => $valor_mdo_total,
            ];

            $itens[] = $parsed;

            // Accumulate totals
            if ($categoria === 'oficina') {
                $totais['oficina'] += $valor_peca;
            } elseif ($categoria === 'seguradora') {
                $totais['seguradora'] += $valor_peca;
            }
            $totais['servico'] += $valor_mdo_total;
        }
    }

    // Resumo do orcamento
    $resumo_xml = [
        'valor_bruto_pecas' => floatval($xml->total_do_orcamento->valor_bruto_pecas ?? 0),
        'valor_liquido_mao_de_obra' => floatval($xml->total_do_orcamento->valor_liquido_mao_de_obra ?? 0),
        'valor_total_geral' => floatval($xml->total_do_orcamento->valor_total_geral ?? 0),
        'valor_pecas_pela_oficina' => floatval($xml->total_do_orcamento->valor_pecas_pela_oficina ?? 0),
        'valor_franquia' => floatval($xml->total_do_orcamento->valor_franquia ?? 0),
    ];

    echo json_encode([
        'status' => 'success',
        'seguradora' => $seguradora,
        'numero_orcamento' => $numero_orcamento,
        'numero_sinistro' => $numero_sinistro,
        'cliente' => $cliente,
        'veiculo' => $veiculo,
        'padrao_mao_de_obra' => [
            'valor_hora_mdo' => $valor_hora_mdo,
            'valor_hora_reparacao' => $valor_hora_rep,
            'valor_hora_pintura' => $valor_hora_pin,
        ],
        'itens' => $itens,
        'totais' => $totais,
        'resumo_xml' => $resumo_xml,
    ]);
    exit;
}

// ============================================
// ACTION: Buscar Cliente no VHSYS
// ============================================
if ($action === 'buscar_cliente') {
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $nome = $_GET['nome'] ?? '';
    $user_id = $_GET['user_id'] ?? null;
    if (!$nome) {
        http_response_code(400);
        echo json_encode(['error' => 'Nome não informado']);
        exit;
    }

    $url = $baseUrl . '/clientes?razao_cliente=' . urlencode($nome);
    $headers = getVhsysHeaders($conn, $user_id, $config);
    $response = makeRequest($url, $headers, 'GET');
    echo $response;
    exit;
}

// ============================================
// ACTION: Criar OS no VHSYS
// ============================================
if ($action === 'criar_os') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Dados invalidos']);
        exit;
    }

    $user_id = $data['user_id'] ?? null;
    $headers = getVhsysHeaders($conn, $user_id, $config);

    // Build VHSYS payload
    $payload = [
        'id_cliente' => $data['id_cliente'] ?? null,
        'nome_cliente' => $data['nome_cliente'] ?? '',
        'referencia_ordem' => $data['referencia_ordem'] ?? '',
        'obs_pedido' => $data['obs_pedido'] ?? '',
        'obs_interno_pedido' => $data['obs_interno_pedido'] ?? '',
        'equipamento_ordem' => $data['equipamento_ordem'] ?? '',
        'status_pedido' => 'Em Aberto',
        'data_pedido' => date('Y-m-d'),
        'tipo_atendimento_ordem' => 'Interno',
    ];

    $url = $baseUrl . '/ordens-servico';
    $response = makeRequest($url, $headers, 'POST', $payload);
    $responseData = json_decode($response, true);

    $vhsys_os_id = $responseData['data']['id_ordem'] ?? null;
    $status = ($responseData['code'] ?? 0) == 200 ? 'sucesso' : 'erro';
    $erro_msg = $status === 'erro' ? ($responseData['data'] ?? 'Erro desconhecido') : null;

    // Insert Items into the VHSYS OS
    if ($vhsys_os_id && $status === 'sucesso' && !empty($data['itens'])) {
        foreach ($data['itens'] as $item) {
            $categoria = $item['categoria'] ?? 'servico';
            
            if ($categoria === 'servico') {
                // Determine hours and price for service
                $horas_totais = floatval($item['hora_ri'] ?? 0) + floatval($item['hora_reparacao'] ?? 0) + floatval($item['hora_pintura'] ?? 0);
                if ($horas_totais <= 0) $horas_totais = 1; // Default to 1 hour if not specified to prevent API errors
                
                // We calculate an implied unit rate from the total MDO value, or fallback to the provided values
                $valor_total_mdo = floatval($item['valor_mdo_total'] ?? 0);
                $valor_unit = $horas_totais > 0 ? ($valor_total_mdo / $horas_totais) : $valor_total_mdo;
                
                // Build service name from type flags + description (Mudança 2)
                $desc_servico = buildTipoServico($item);
                $desc_servico = $desc_servico ? mb_substr($desc_servico, 0, 255) : 'Serviço Avulso';
                
                $servico_payload = [
                    'id_servico' => 0, // Sending 0 or omitting might allow avulso creation.
                    'desc_servico' => $desc_servico,
                    'horas_servico' => $horas_totais,
                    'valor_unit_servico' => round($valor_unit, 2),
                ];
                
                $item_url = $baseUrl . '/ordens-servico/' . $vhsys_os_id . '/servicos';
                makeRequest($item_url, $headers, 'POST', $servico_payload);
            } else if ($categoria === 'oficina') {
                // Product - Apenas fornecimento Oficina
                $desc_produto = $item['nome'] ? mb_substr($item['nome'], 0, 255) : 'Produto Avulso';
                $id_produto = buscarProdutoPorDescricao($baseUrl, $headers, $desc_produto);
                
                if (!$id_produto) {
                    $id_produto = cadastrarProduto($baseUrl, $headers, $item);
                }
                
                $produto_payload = [
                    'id_produto' => $id_produto ?: 0,
                    'desc_produto' => $desc_produto,
                    'qtde_produto' => intval($item['quantidade'] ?? 1),
                    'valor_unit_produto' => floatval($item['valor_peca'] ?? 0),
                ];
                
                $item_url = $baseUrl . '/ordens-servico/' . $vhsys_os_id . '/produtos';
                makeRequest($item_url, $headers, 'POST', $produto_payload);
            }
            // Itens de seguradora são ignorados - não inseridos na OS
        }
    }

    // Log the import
    $user_id = $data['user_id'] ?? null;
    if ($user_id) {
        try {
            $stmt = $conn->prepare("INSERT INTO cilia_importacoes (user_id, nome_arquivo, seguradora, placa, cliente_nome, vhsys_os_id, tipos_importados, total_itens, valor_total, status, erro_mensagem) VALUES (:user_id, :nome_arquivo, :seguradora, :placa, :cliente_nome, :vhsys_os_id, :tipos, :total_itens, :valor_total, :status, :erro)");
            $stmt->execute([
                ':user_id' => $user_id,
                ':nome_arquivo' => $data['nome_arquivo'] ?? '',
                ':seguradora' => $data['seguradora'] ?? '',
                ':placa' => $data['placa'] ?? '',
                ':cliente_nome' => $data['nome_cliente'] ?? '',
                ':vhsys_os_id' => $vhsys_os_id,
                ':tipos' => $data['tipos_importados'] ?? '',
                ':total_itens' => $data['total_itens'] ?? 0,
                ':valor_total' => $data['valor_total'] ?? 0,
                ':status' => $status,
                ':erro' => is_string($erro_msg) ? $erro_msg : json_encode($erro_msg),
            ]);
        } catch (Exception $e) {
            // Log silently, don't fail the OS creation
        }
    }

    echo $response;
    exit;
}

// ============================================
// ACTION: Historico de importacoes
// ============================================
if ($action === 'historico') {
    $user_id = $_GET['user_id'] ?? null;

    if ($method === 'GET') {
        if ($user_id) {
            // Check if admin - admins see all
            if (isAdmin($conn, $user_id)) {
                $stmt = $conn->prepare("SELECT i.*, u.username FROM cilia_importacoes i JOIN cilia_usuarios u ON i.user_id = u.id ORDER BY i.created_at DESC LIMIT 100");
            } else {
                $stmt = $conn->prepare("SELECT * FROM cilia_importacoes WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 50");
                $stmt->bindParam(':user_id', $user_id);
            }
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } else {
            echo json_encode([]);
        }
    }
    exit;
}

// ============================================
// ACTION: Admin - Gerenciar Usuarios
// ============================================
if ($action === 'admin_usuarios') {
    $admin_id = $_GET['admin_id'] ?? null;

    if (!$admin_id || !isAdmin($conn, $admin_id)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Acesso negado']);
        exit;
    }

    // GET: List all users
    if ($method === 'GET') {
        $stmt = $conn->prepare("SELECT id, username, nome_completo, email, empresa, role, ativo, created_at, vhsys_access_token FROM cilia_usuarios ORDER BY created_at DESC");
        $stmt->execute();
        
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Only indicate if the key is configured, do not broadcast the actual keys to the admin
        foreach ($users as &$user) {
            $user['has_vhsys_keys'] = !empty($user['vhsys_access_token']);
            unset($user['vhsys_access_token']);
        }
        
        echo json_encode($users);
    }

    // POST: Create user
    elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';
        $nome = $data['nome_completo'] ?? '';
        $email = $data['email'] ?? '';
        $empresa = $data['empresa'] ?? '';
        $vhsys_access = $data['vhsys_access_token'] ?? null;
        $vhsys_secret = $data['vhsys_secret_token'] ?? null;

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Username e senha obrigatorios']);
            exit;
        }

        // Check duplicate
        $check = $conn->prepare("SELECT id FROM cilia_usuarios WHERE username = :user");
        $check->bindParam(':user', $username);
        $check->execute();
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['status' => 'error', 'message' => 'Username ja existe']);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO cilia_usuarios (username, password, nome_completo, email, empresa, role, vhsys_access_token, vhsys_secret_token) VALUES (:user, :pass, :nome, :email, :empresa, 'user', :access, :secret)");
        $stmt->execute([
            ':user' => $username,
            ':pass' => $password,
            ':nome' => $nome,
            ':email' => $email,
            ':empresa' => $empresa,
            ':access' => $vhsys_access,
            ':secret' => $vhsys_secret
        ]);

        echo json_encode(['status' => 'success', 'id' => $conn->lastInsertId(), 'message' => 'Usuario criado com sucesso']);
    }

    // PUT: Update user
    elseif ($method === 'PUT' && $id) {
        $data = json_decode(file_get_contents('php://input'), true);

        $fields = [];
        $params = [':id' => $id];

        if (isset($data['nome_completo'])) { $fields[] = "nome_completo = :nome"; $params[':nome'] = $data['nome_completo']; }
        if (isset($data['email'])) { $fields[] = "email = :email"; $params[':email'] = $data['email']; }
        if (isset($data['empresa'])) { $fields[] = "empresa = :empresa"; $params[':empresa'] = $data['empresa']; }
        if (isset($data['password']) && !empty($data['password'])) { $fields[] = "password = :pass"; $params[':pass'] = $data['password']; }
        if (isset($data['ativo'])) { $fields[] = "ativo = :ativo"; $params[':ativo'] = $data['ativo']; }
        if (isset($data['vhsys_access_token']) && $data['vhsys_access_token'] !== '') { $fields[] = "vhsys_access_token = :access"; $params[':access'] = $data['vhsys_access_token']; }
        if (isset($data['vhsys_secret_token']) && $data['vhsys_secret_token'] !== '') { $fields[] = "vhsys_secret_token = :secret"; $params[':secret'] = $data['vhsys_secret_token']; }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nenhum campo para atualizar']);
            exit;
        }

        $sql = "UPDATE cilia_usuarios SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['status' => 'success', 'message' => 'Usuario atualizado']);
    }

    // DELETE: Deactivate user (soft delete)
    elseif ($method === 'DELETE' && $id) {
        // Don't allow deleting self
        if ($id == $admin_id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nao e possivel excluir seu proprio usuario']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE cilia_usuarios SET ativo = 0 WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'success', 'message' => 'Usuario desativado']);
    }

    exit;
}

// ============================================
// Fallback
// ============================================
http_response_code(400);
echo json_encode(['error' => 'Acao invalida ou parametros ausentes']);
