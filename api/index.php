<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

session_start();

$pdo = ensure_app_bootstrap();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/', '/');
$segments = explode('/', $path);
$endpoint = (string) ($_GET['endpoint'] ?? ($segments[count($segments) - 1] ?? ''));

header('Content-Type: application/json; charset=utf-8');

try {
    route($pdo, $method, $endpoint);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Erro interno do servidor.',
        'error' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

function route(PDO $pdo, string $method, string $endpoint): void
{
    if ($method === 'OPTIONS') {
        http_response_code(204);
        return;
    }

    switch ($endpoint) {
        case 'register':
            require_method('POST', $method);
            register_user($pdo);
            return;
        case 'login':
            require_method('POST', $method);
            login_user($pdo);
            return;
        case 'logout':
            require_method('POST', $method);
            logout_user();
            return;
        case 'me':
            require_method('GET', $method);
            current_user();
            return;
        case 'products':
            if ($method === 'GET') {
                list_products($pdo);
                return;
            }
            require_admin();
            if ($method === 'POST') {
                save_product($pdo);
                return;
            }
            if ($method === 'DELETE') {
                delete_product($pdo);
                return;
            }
            break;
        case 'orders':
            if ($method === 'GET') {
                require_user();
                list_customer_orders($pdo);
                return;
            }
            if ($method === 'POST') {
                create_order($pdo);
                return;
            }
            break;
        case 'admin-orders':
            require_admin();
            if ($method === 'GET') {
                list_admin_orders($pdo);
                return;
            }
            if ($method === 'POST') {
                update_order_status($pdo);
                return;
            }
            break;
        case 'admin-dashboard':
            require_admin();
            require_method('GET', $method);
            get_admin_dashboard($pdo);
            return;
        case 'admin-clients':
            require_admin();
            require_method('GET', $method);
            list_admin_clients($pdo);
            return;
        case 'admin-sales-report':
            require_admin();
            require_method('GET', $method);
            get_admin_sales_report($pdo);
            return;
        case 'admin-stock-entry':
            require_admin();
            require_method('POST', $method);
            create_admin_stock_entry($pdo);
            return;
        case 'store-settings':
            require_admin();
            if ($method === 'GET') {
                get_store_settings($pdo);
                return;
            }
            if ($method === 'POST') {
                save_store_settings($pdo);
                return;
            }
            break;
        case 'public-store-settings':
            require_method('GET', $method);
            get_public_store_settings($pdo);
            return;
    }

    json_response(['ok' => false, 'message' => 'Endpoint não encontrado.'], 404);
}

function require_method(string $expected, string $actual): void
{
    if ($expected !== $actual) {
        json_response(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }
}

function get_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(['ok' => false, 'message' => 'JSON inválido.'], 400);
    }

    return $data;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_user(): void
{
    if (empty($_SESSION['user'])) {
        json_response(['ok' => false, 'message' => 'Faça login para continuar.'], 401);
    }
}

function require_admin(): void
{
    require_user();
    if (empty($_SESSION['user']['is_admin'])) {
        json_response(['ok' => false, 'message' => 'Acesso restrito ao administrador.'], 403);
    }
}

function register_user(PDO $pdo): void
{
    $data = get_json_input();
    $name = trim((string) ($data['name'] ?? ''));
    $cpf = trim((string) ($data['cpf'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $address = trim((string) ($data['address'] ?? ''));
    $city = trim((string) ($data['city'] ?? ''));
    $neighborhood = trim((string) ($data['neighborhood'] ?? ''));
    $phone = trim((string) ($data['phone'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($name === '' || $cpf === '' || $email === '' || $address === '' || $city === '' || $phone === '' || $password === '') {
        json_response(['ok' => false, 'message' => 'Todos os campos são obrigatórios.'], 422);
    }

    if (is_ilha_solteira_city($city)) {
        $canonical = canonical_ilha_neighborhood($neighborhood);
        if ($canonical === null) {
            json_response(['ok' => false, 'message' => 'Selecione um bairro válido de Ilha Solteira.'], 422);
        }
        $neighborhood = $canonical;
    } else {
        $neighborhood = '';
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if ($check->fetch()) {
        json_response(['ok' => false, 'message' => 'Já existe um cadastro com este e-mail.'], 409);
    }

    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, phone, cpf, address, city, neighborhood, is_admin)
         VALUES (:name, :email, :password_hash, :phone, :cpf, :address, :city, :neighborhood, 0)'
    );
    $insert->execute([
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'phone' => $phone,
        'cpf' => $cpf,
        'address' => $address,
        'city' => $city,
        'neighborhood' => $neighborhood,
    ]);

    $_SESSION['user'] = [
        'id' => (int) $pdo->lastInsertId(),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'cpf' => $cpf,
        'address' => $address,
        'city' => $city,
        'neighborhood' => $neighborhood,
        'is_admin' => false,
    ];

    json_response(['ok' => true, 'user' => $_SESSION['user']], 201);
}

function login_user(PDO $pdo): void
{
    $data = get_json_input();
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');

    if ($email === '' || $password === '') {
        json_response(['ok' => false, 'message' => 'Informe e-mail e senha.'], 422);
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        json_response(['ok' => false, 'message' => 'Usuário ou senha inválidos.'], 401);
    }

    $_SESSION['user'] = sanitize_user($user);
    json_response(['ok' => true, 'user' => $_SESSION['user']]);
}

function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    json_response(['ok' => true]);
}

function current_user(): void
{
    json_response(['ok' => true, 'user' => $_SESSION['user'] ?? null]);
}

function list_products(PDO $pdo): void
{
    $onlyActive = empty($_SESSION['user']['is_admin']);
    $sql = 'SELECT id, codigo, descricao, custo_unit, saldo, total, image_url, categoria, ativo
            FROM products';
    if ($onlyActive) {
        $sql .= ' WHERE ativo = 1';
    }
    $sql .= ' ORDER BY descricao ASC';

    $rows = $pdo->query($sql)->fetchAll();
    $products = array_map(static fn(array $row): array => normalize_product($row), $rows);

    json_response(['ok' => true, 'products' => $products]);
}

function save_product(PDO $pdo): void
{
    $data = get_json_input();
    $id = isset($data['id']) ? (int) $data['id'] : 0;
    $codigo = trim((string) ($data['codigo'] ?? ''));
    $descricao = trim((string) ($data['descricao'] ?? ''));
    $custo = parse_money_to_float((string) ($data['custo_unit'] ?? '0'));
    $saldo = trim((string) ($data['saldo'] ?? '-'));
    $total = trim((string) ($data['total'] ?? '-'));
    $imageUrl = trim((string) ($data['image_url'] ?? ''));
    $categoria = trim((string) ($data['categoria'] ?? infer_category($descricao . ' ' . $codigo)));
    $ativo = !empty($data['ativo']) ? 1 : 0;

    if ($codigo === '' || $descricao === '') {
        json_response(['ok' => false, 'message' => 'Código e descrição são obrigatórios.'], 422);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare(
            'UPDATE products
             SET codigo = :codigo, descricao = :descricao, custo_unit = :custo_unit, saldo = :saldo,
                 total = :total, image_url = :image_url, categoria = :categoria, ativo = :ativo,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'codigo' => $codigo,
            'descricao' => $descricao,
            'custo_unit' => $custo,
            'saldo' => $saldo,
            'total' => $total,
            'image_url' => $imageUrl,
            'categoria' => $categoria,
            'ativo' => $ativo,
        ]);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO products (codigo, descricao, custo_unit, saldo, total, image_url, categoria, ativo, updated_at)
             VALUES (:codigo, :descricao, :custo_unit, :saldo, :total, :image_url, :categoria, :ativo, CURRENT_TIMESTAMP)'
        );
        $stmt->execute([
            'codigo' => $codigo,
            'descricao' => $descricao,
            'custo_unit' => $custo,
            'saldo' => $saldo,
            'total' => $total,
            'image_url' => $imageUrl,
            'categoria' => $categoria,
            'ativo' => $ativo,
        ]);
        $id = (int) $pdo->lastInsertId();
    }

    $row = $pdo->query('SELECT * FROM products WHERE id = ' . $id)->fetch();
    json_response(['ok' => true, 'product' => normalize_product($row)]);
}

function delete_product(PDO $pdo): void
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        json_response(['ok' => false, 'message' => 'Produto inválido.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM products WHERE id = :id');
    $stmt->execute(['id' => $id]);

    json_response(['ok' => true]);
}

function create_order(PDO $pdo): void
{
    $data = get_json_input();
    $items = $data['items'] ?? [];
    $notes = trim((string) ($data['notes'] ?? ''));
    $paymentMethod = trim((string) ($data['payment_method'] ?? ''));
    $customerName = trim((string) ($data['customer_name'] ?? ''));
    $customerPhone = trim((string) ($data['customer_phone'] ?? ''));
    $customerAddress = trim((string) ($data['customer_address'] ?? ''));
    $customerCityInput = trim((string) ($data['customer_city'] ?? ''));
    $customerNeighborhoodInput = trim((string) ($data['customer_neighborhood'] ?? ''));
    $allowedPaymentMethods = ['pix', 'cartao', 'dinheiro'];

    if (!is_array($items) || count($items) === 0) {
        json_response(['ok' => false, 'message' => 'Adicione ao menos um item ao pedido.'], 422);
    }
    if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
        json_response(['ok' => false, 'message' => 'Selecione uma forma de pagamento válida (pix, cartao ou dinheiro).'], 422);
    }
    if ($customerName === '' || $customerPhone === '' || $customerAddress === '' || $customerCityInput === '') {
        json_response(['ok' => false, 'message' => 'Informe nome, telefone, endereço e cidade para finalizar.'], 422);
    }

    $currentUser = $_SESSION['user'] ?? null;
    $cityRequiresRegistration = city_requires_registration($pdo, $customerCityInput);
    if (!$currentUser && $cityRequiresRegistration) {
        json_response(['ok' => false, 'message' => 'Esta cidade exige cadastro. Faça login para continuar.'], 401);
    }

    $orderUserId = $currentUser
        ? (int) $currentUser['id']
        : guest_user_id($pdo);

    $neighborhoodForOrder = $customerNeighborhoodInput;
    if (is_ilha_solteira_city($customerCityInput)) {
        if ($neighborhoodForOrder === '' && $currentUser) {
            $neighborhoodForOrder = trim((string) ($currentUser['neighborhood'] ?? ''));
        }
        $canonical = canonical_ilha_neighborhood($neighborhoodForOrder);
        if ($canonical === null) {
            json_response(['ok' => false, 'message' => 'Em Ilha Solteira é obrigatório informar o bairro.'], 422);
        }
        $customerCityStored = 'Ilha Solteira — ' . $canonical;
    } else {
        $customerCityStored = $customerCityInput;
    }

    $pdo->beginTransaction();
    try {
        $normalizedItems = [];
        $total = 0.0;
        $productStmt = $pdo->prepare('SELECT * FROM products WHERE id = :id AND ativo = 1 LIMIT 1');

        foreach ($items as $item) {
            $productId = (int) ($item['product_id'] ?? 0);
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $productStmt->execute(['id' => $productId]);
            $product = $productStmt->fetch();
            if (!$product) {
                throw new RuntimeException('Produto não encontrado para o pedido.');
            }

            $unitPrice = (float) $product['custo_unit'];
            $lineTotal = $unitPrice * $quantity;
            $total += $lineTotal;
            $normalizedItems[] = [
                'product' => $product,
                'quantity' => $quantity,
                'line_total' => $lineTotal,
            ];
        }

        $defaultShipping = get_default_shipping_fee($pdo);
        $shippingFee = calculate_shipping_fee($customerCityStored, $total, $defaultShipping);
        $total += $shippingFee;

        $orderStmt = $pdo->prepare(
            'INSERT INTO orders (user_id, status, payment_method, customer_name, customer_phone, customer_address, customer_city, total_amount, notes, updated_at)
             VALUES (:user_id, "novo", :payment_method, :customer_name, :customer_phone, :customer_address, :customer_city, :total_amount, :notes, CURRENT_TIMESTAMP)'
        );
        $orderStmt->execute([
            'user_id' => $orderUserId,
            'payment_method' => $paymentMethod,
            'customer_name' => $customerName,
            'customer_phone' => $customerPhone,
            'customer_address' => $customerAddress,
            'customer_city' => $customerCityStored,
            'total_amount' => $total,
            'notes' => $notes,
        ]);
        $orderId = (int) $pdo->lastInsertId();

        $itemStmt = $pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, product_code, product_name, unit_price, quantity, line_total)
             VALUES (:order_id, :product_id, :product_code, :product_name, :unit_price, :quantity, :line_total)'
        );

        foreach ($normalizedItems as $item) {
            $product = $item['product'];
            $itemStmt->execute([
                'order_id' => $orderId,
                'product_id' => (int) $product['id'],
                'product_code' => (string) $product['codigo'],
                'product_name' => (string) $product['descricao'],
                'unit_price' => (float) $product['custo_unit'],
                'quantity' => (int) $item['quantity'],
                'line_total' => (float) $item['line_total'],
            ]);
        }

        $pdo->commit();
        json_response(['ok' => true, 'message' => 'Pedido realizado com sucesso.', 'order_id' => $orderId], 201);
    } catch (Throwable $exception) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => $exception->getMessage()], 422);
    }
}

function list_customer_orders(PDO $pdo): void
{
    $stmt = $pdo->prepare(
        'SELECT id, status, payment_method, customer_name, customer_phone, customer_address, customer_city, total_amount, notes, created_at
         FROM orders
         WHERE user_id = :user_id
         ORDER BY id DESC'
    );
    $stmt->execute(['user_id' => (int) $_SESSION['user']['id']]);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $order['total_amount'] = (float) $order['total_amount'];
        $order['items'] = order_items($pdo, (int) $order['id']);
    }

    json_response(['ok' => true, 'orders' => $orders]);
}

function list_admin_orders(PDO $pdo): void
{
    $status = trim((string) ($_GET['status'] ?? ''));
    $sql = 'SELECT o.id, o.status, o.payment_method, o.total_amount, o.notes, o.created_at,
                   o.customer_name, o.customer_phone, o.customer_address, o.customer_city,
                   u.name AS user_name, u.email AS user_email, u.phone AS user_phone
            FROM orders o
            INNER JOIN users u ON u.id = o.user_id';

    $params = [];
    if ($status !== '') {
        $sql .= ' WHERE o.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY o.id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $order['total_amount'] = (float) $order['total_amount'];
        $order['customer_name'] = (string) ($order['customer_name'] !== '' ? $order['customer_name'] : ($order['user_name'] ?? ''));
        $order['customer_phone'] = (string) ($order['customer_phone'] !== '' ? $order['customer_phone'] : ($order['user_phone'] ?? ''));
        $order['customer_address'] = (string) ($order['customer_address'] ?? '');
        $order['customer_city'] = (string) ($order['customer_city'] ?? '');
        $order['items'] = order_items($pdo, (int) $order['id']);
    }

    json_response(['ok' => true, 'orders' => $orders]);
}

function update_order_status(PDO $pdo): void
{
    $data = get_json_input();
    $id = (int) ($data['id'] ?? 0);
    $status = trim((string) ($data['status'] ?? ''));
    $allowed = ['novo', 'em_preparo', 'enviado', 'concluido', 'cancelado'];

    if ($id <= 0 || !in_array($status, $allowed, true)) {
        json_response(['ok' => false, 'message' => 'Pedido ou status inválido.'], 422);
    }

    $stmt = $pdo->prepare('UPDATE orders SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $stmt->execute([
        'id' => $id,
        'status' => $status,
    ]);

    json_response(['ok' => true]);
}

function get_admin_dashboard(PDO $pdo): void
{
    $totals = [
        'orders' => (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
        'new_orders' => (int) $pdo->query('SELECT COUNT(*) FROM orders WHERE status = "novo"')->fetchColumn(),
        'products' => (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn(),
        'active_products' => (int) $pdo->query('SELECT COUNT(*) FROM products WHERE ativo = 1')->fetchColumn(),
        'clients' => (int) $pdo->query('SELECT COUNT(*) FROM users WHERE is_admin = 0')->fetchColumn(),
        'revenue' => (float) $pdo->query('SELECT COALESCE(SUM(total_amount), 0) FROM orders')->fetchColumn(),
    ];
    json_response(['ok' => true, 'dashboard' => $totals]);
}

function list_admin_clients(PDO $pdo): void
{
    $query = trim((string) ($_GET['q'] ?? ''));
    $sql = 'SELECT u.id, u.name, u.email, u.phone, u.cpf, u.address, u.created_at,
                   COUNT(o.id) AS orders_count,
                   COALESCE(SUM(o.total_amount), 0) AS total_spent
            FROM users u
            LEFT JOIN orders o ON o.user_id = u.id
            WHERE u.is_admin = 0';
    $params = [];
    if ($query !== '') {
        $sql .= ' AND (u.name LIKE :query OR u.email LIKE :query OR u.phone LIKE :query OR u.cpf LIKE :query)';
        $params['query'] = '%' . $query . '%';
    }
    $sql .= ' GROUP BY u.id ORDER BY u.created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $clients = $stmt->fetchAll();
    $clients = array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) ($row['phone'] ?? ''),
            'cpf' => (string) ($row['cpf'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'created_at' => (string) $row['created_at'],
            'orders_count' => (int) $row['orders_count'],
            'total_spent' => (float) $row['total_spent'],
        ];
    }, $clients);
    json_response(['ok' => true, 'clients' => $clients]);
}

function get_admin_sales_report(PDO $pdo): void
{
    $cityRows = $pdo->query(
        'SELECT o.customer_city AS city,
                COUNT(DISTINCT o.id) AS orders_count,
                COALESCE(SUM(oi.quantity), 0) AS items_sold,
                COALESCE(SUM(oi.line_total), 0) AS revenue
         FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
         GROUP BY o.customer_city
         ORDER BY revenue DESC, orders_count DESC, city ASC'
    )->fetchAll();

    $cities = array_map(static function (array $row): array {
        return [
            'city' => (string) ($row['city'] ?? ''),
            'orders_count' => (int) $row['orders_count'],
            'items_sold' => (int) $row['items_sold'],
            'revenue' => (float) $row['revenue'],
        ];
    }, $cityRows);

    $productRows = $pdo->query(
        'SELECT oi.product_id, oi.product_name,
                COALESCE(SUM(oi.quantity), 0) AS total_quantity,
                COALESCE(SUM(oi.line_total), 0) AS revenue
         FROM order_items oi
         GROUP BY oi.product_id, oi.product_name
         ORDER BY total_quantity DESC, revenue DESC, oi.product_name ASC
         LIMIT 10'
    )->fetchAll();

    $topProducts = array_map(static function (array $row): array {
        return [
            'product_id' => (int) ($row['product_id'] ?? 0),
            'product_name' => (string) ($row['product_name'] ?? ''),
            'total_quantity' => (int) $row['total_quantity'],
            'revenue' => (float) $row['revenue'],
        ];
    }, $productRows);

    json_response([
        'ok' => true,
        'report' => [
            'cities' => $cities,
            'top_products' => $topProducts,
        ],
    ]);
}

function create_admin_stock_entry(PDO $pdo): void
{
    $data = get_json_input();
    $items = $data['items'] ?? [];
    $source = trim((string) ($data['source'] ?? 'nota_foto'));
    $noteText = trim((string) ($data['note_text'] ?? ''));
    $adminId = (int) ($_SESSION['user']['id'] ?? 0);

    if (!is_array($items) || count($items) === 0) {
        json_response(['ok' => false, 'message' => 'Nenhum item informado para entrada de estoque.'], 422);
    }

    $selectProduct = $pdo->prepare('SELECT id, saldo FROM products WHERE id = :id LIMIT 1');
    $updateProduct = $pdo->prepare(
        'UPDATE products
         SET saldo = :saldo, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $insertEntry = $pdo->prepare(
        'INSERT INTO stock_entries (product_id, quantity, source, note_text, created_by)
         VALUES (:product_id, :quantity, :source, :note_text, :created_by)'
    );

    $processed = [];
    $pdo->beginTransaction();
    try {
        foreach ($items as $item) {
            $productId = (int) ($item['product_id'] ?? 0);
            $quantity = (float) ($item['quantity'] ?? 0);
            if ($productId <= 0 || $quantity <= 0) {
                continue;
            }

            $selectProduct->execute(['id' => $productId]);
            $product = $selectProduct->fetch();
            if (!$product) {
                continue;
            }

            $currentStock = parse_stock_value((string) ($product['saldo'] ?? '0'));
            $newStock = $currentStock + $quantity;

            $updateProduct->execute([
                'id' => $productId,
                'saldo' => format_stock_value($newStock),
            ]);
            $insertEntry->execute([
                'product_id' => $productId,
                'quantity' => $quantity,
                'source' => $source,
                'note_text' => $noteText,
                'created_by' => $adminId,
            ]);
            $processed[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'new_stock' => $newStock,
            ];
        }

        if (count($processed) === 0) {
            throw new RuntimeException('Nenhum item válido encontrado para entrada.');
        }

        $pdo->commit();
        json_response([
            'ok' => true,
            'message' => 'Entrada de estoque realizada com sucesso.',
            'entries' => $processed,
        ]);
    } catch (Throwable $exception) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => $exception->getMessage()], 422);
    }
}

function parse_stock_value(string $value): float
{
    $value = trim($value);
    if ($value === '' || $value === '-') {
        return 0.0;
    }
    $normalized = str_replace([' ', ','], ['', '.'], $value);
    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function format_stock_value(float $value): string
{
    if (abs($value - round($value)) < 0.000001) {
        return (string) ((int) round($value));
    }
    return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
}

function get_store_settings(PDO $pdo): void
{
    $settings = $pdo->query('SELECT store_name, phone, email, default_shipping FROM store_settings WHERE id = 1')->fetch();
    if (!$settings) {
        $settings = [
            'store_name' => 'Casa das Rações Isa',
            'phone' => '',
            'email' => '',
            'default_shipping' => 0,
        ];
    }
    $cities = $pdo->query('SELECT id, name, require_registration FROM store_cities ORDER BY name ASC')->fetchAll();
    $cities = array_map(static function (array $city): array {
        return [
            'id' => (int) $city['id'],
            'name' => (string) $city['name'],
            'require_registration' => (bool) $city['require_registration'],
        ];
    }, $cities);
    json_response([
        'ok' => true,
        'settings' => [
            'store_name' => (string) $settings['store_name'],
            'phone' => (string) $settings['phone'],
            'email' => (string) $settings['email'],
            'default_shipping' => (float) $settings['default_shipping'],
            'cities' => $cities,
        ],
    ]);
}

function get_public_store_settings(PDO $pdo): void
{
    $settings = $pdo->query('SELECT store_name, phone, email, default_shipping FROM store_settings WHERE id = 1')->fetch();
    if (!$settings) {
        $settings = [
            'store_name' => 'Casa das Rações Isa',
            'phone' => '',
            'email' => '',
            'default_shipping' => 0,
        ];
    }
    $cities = $pdo->query('SELECT id, name, require_registration FROM store_cities ORDER BY name ASC')->fetchAll();
    $cities = array_map(static function (array $city): array {
        return [
            'id' => (int) $city['id'],
            'name' => (string) $city['name'],
            'require_registration' => (bool) $city['require_registration'],
        ];
    }, $cities);
    json_response([
        'ok' => true,
        'settings' => [
            'store_name' => (string) $settings['store_name'],
            'phone' => (string) $settings['phone'],
            'email' => (string) $settings['email'],
            'default_shipping' => (float) $settings['default_shipping'],
            'cities' => $cities,
        ],
    ]);
}

function save_store_settings(PDO $pdo): void
{
    $data = get_json_input();
    $storeName = trim((string) ($data['store_name'] ?? ''));
    $phone = trim((string) ($data['phone'] ?? ''));
    $email = trim((string) ($data['email'] ?? ''));
    $defaultShipping = parse_money_to_float((string) ($data['default_shipping'] ?? '0'));
    $cities = $data['cities'] ?? [];

    if ($storeName === '') {
        json_response(['ok' => false, 'message' => 'Nome da loja é obrigatório.'], 422);
    }
    if (!is_array($cities)) {
        json_response(['ok' => false, 'message' => 'Lista de cidades inválida.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'UPDATE store_settings
             SET store_name = :store_name, phone = :phone, email = :email,
                 default_shipping = :default_shipping, updated_at = CURRENT_TIMESTAMP
             WHERE id = 1'
        );
        $stmt->execute([
            'store_name' => $storeName,
            'phone' => $phone,
            'email' => $email,
            'default_shipping' => $defaultShipping,
        ]);

        $pdo->exec('DELETE FROM store_cities');
        $insert = $pdo->prepare('INSERT INTO store_cities (name, require_registration) VALUES (:name, :require_registration)');
        foreach ($cities as $city) {
            $cityName = trim((string) ($city['name'] ?? ''));
            if ($cityName === '') {
                continue;
            }
            $insert->execute([
                'name' => $cityName,
                'require_registration' => !empty($city['require_registration']) ? 1 : 0,
            ]);
        }

        $pdo->commit();
        get_store_settings($pdo);
    } catch (Throwable $exception) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => $exception->getMessage()], 422);
    }
}

function city_requires_registration(PDO $pdo, string $city): bool
{
    $city = trim($city);
    if ($city === '') {
        return false;
    }
    $stmt = $pdo->prepare('SELECT require_registration FROM store_cities WHERE LOWER(name) = LOWER(:name) LIMIT 1');
    $stmt->execute(['name' => $city]);
    $row = $stmt->fetch();
    return (bool) ($row['require_registration'] ?? false);
}

function normalize_name(string $value): string
{
    // remove_accents trata maiúsculas e minúsculas acentuadas; strtolower lida com o que sobra (ASCII).
    return strtolower(remove_accents(trim($value)));
}

/**
 * Remove sufixos de UF (ex.: " - SP", "/MS", " — RJ") do final do nome da cidade.
 * Mantém o restante intacto para que comparações por nome sejam estáveis,
 * independentemente de o admin cadastrar a cidade com ou sem o estado.
 */
function clean_city_name(string $city): string
{
    $value = trim($city);
    if ($value === '') {
        return '';
    }
    $cleaned = preg_replace('#\s*[/\-–—]\s*[A-Za-z]{2}\s*$#u', '', $value);
    return trim((string) ($cleaned ?? $value));
}

/** Bairros de Ilha Solteira oferecidos no cadastro/checkout. */
function ilha_solteira_neighborhoods(): array
{
    return [
        'Morada do Sol',
        'Zona Sul',
        'Zona Norte',
        'Ipê',
        'Praia',
        'Cinturão Verde',
        'Recanto das Águas',
        'Jardim Aeroporto',
        'Novo Horizonte',
        'Ilha do Sol',
        'Nova Ilha',
        'Ilha Bela',
        'Santa Catarina',
        'Morumbi',
        'Coabi',
        'Portal do Bosque',
    ];
}

function is_ilha_solteira_city(string $city): bool
{
    return normalize_name(clean_city_name($city)) === 'ilha solteira';
}

/** Retorna o nome canônico do bairro ou null se inválido. */
function canonical_ilha_neighborhood(string $neighborhood): ?string
{
    $neighborhood = trim($neighborhood);
    if ($neighborhood === '') {
        return null;
    }
    $needle = normalize_name($neighborhood);
    foreach (ilha_solteira_neighborhoods() as $allowed) {
        if (normalize_name($allowed) === $needle) {
            return $allowed;
        }
    }

    return null;
}

function get_default_shipping_fee(PDO $pdo): float
{
    $value = $pdo->query('SELECT default_shipping FROM store_settings WHERE id = 1')->fetchColumn();
    if ($value === false || $value === null) {
        return 0.0;
    }
    $fee = (float) $value;
    return $fee > 0.0 ? $fee : 0.0;
}

function calculate_shipping_fee(string $customerCity, float $subtotal, float $defaultFee = 0.0): float
{
    $raw = clean_city_name($customerCity);
    $city = normalize_name($raw);
    if (preg_match('/^ilha\s+solteira\s*[—\-]\s*(.+)$/iu', $raw, $matches)) {
        $city = normalize_name(trim($matches[1]));
    }

    // Apenas estes bairros têm taxa fixa de entrega.
    // Os demais bairros de Ilha Solteira seguem a regra geral (R$ 2,50 se subtotal < R$ 20, senão default_shipping).
    $fixedByLocality = [
        'praia' => 5.0,
        'morada do sol' => 5.0,
        'recanto das aguas' => 5.0,
        'cinturao verde' => 5.0,
        'ipe' => 8.0,
    ];

    if (isset($fixedByLocality[$city])) {
        return $fixedByLocality[$city];
    }

    if ($subtotal < 20.0) {
        return 2.5;
    }

    return $defaultFee;
}

function guest_user_id(PDO $pdo): int
{
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => 'visitante@casadasracoes.local']);
    $row = $stmt->fetch();
    if ($row) {
        return (int) $row['id'];
    }

    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, phone, cpf, address, city, neighborhood, is_admin)
         VALUES (:name, :email, :password_hash, :phone, :cpf, :address, :city, :neighborhood, 0)'
    );
    $insert->execute([
        'name' => 'Visitante',
        'email' => 'visitante@casadasracoes.local',
        'password_hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
        'phone' => '',
        'cpf' => '',
        'address' => '',
        'city' => '',
        'neighborhood' => '',
    ]);
    return (int) $pdo->lastInsertId();
}

function order_items(PDO $pdo, int $orderId): array
{
    $stmt = $pdo->prepare(
        'SELECT product_id, product_code, product_name, unit_price, quantity, line_total
         FROM order_items
         WHERE order_id = :order_id
         ORDER BY id ASC'
    );
    $stmt->execute(['order_id' => $orderId]);
    $items = $stmt->fetchAll();

    return array_map(static function (array $item): array {
        $item['unit_price'] = (float) $item['unit_price'];
        $item['line_total'] = (float) $item['line_total'];
        $item['quantity'] = (int) $item['quantity'];
        return $item;
    }, $items);
}

function sanitize_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => (string) $user['name'],
        'email' => (string) $user['email'],
        'phone' => (string) ($user['phone'] ?? ''),
        'cpf' => (string) ($user['cpf'] ?? ''),
        'address' => (string) ($user['address'] ?? ''),
        'city' => (string) ($user['city'] ?? ''),
        'neighborhood' => (string) ($user['neighborhood'] ?? ''),
        'payment_method' => (string) ($user['payment_method'] ?? ''),
        'is_admin' => (bool) $user['is_admin'],
    ];
}

function normalize_product(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'codigo' => (string) $row['codigo'],
        'descricao' => (string) $row['descricao'],
        'custo_unit' => (float) $row['custo_unit'],
        'saldo' => (string) ($row['saldo'] ?? '-'),
        'total' => (string) ($row['total'] ?? '-'),
        'image_url' => (string) ($row['image_url'] ?? ''),
        'categoria' => (string) ($row['categoria'] ?? 'outro'),
        'ativo' => (int) ($row['ativo'] ?? 1),
    ];
}
