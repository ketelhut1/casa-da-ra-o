<?php
declare(strict_types=1);

const APP_ROOT = __DIR__ . DIRECTORY_SEPARATOR . '..';
const DATA_DIR = APP_ROOT . DIRECTORY_SEPARATOR . 'data';
const DB_PATH = DATA_DIR . DIRECTORY_SEPARATOR . 'app.sqlite';
const SOURCE_PRODUCTS_JSON = APP_ROOT . DIRECTORY_SEPARATOR . 'racoes.json';

function ensure_app_bootstrap(): PDO
{
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0777, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    create_schema($pdo);
    seed_admin($pdo);
    seed_guest_user($pdo);
    seed_products_from_json($pdo);

    return $pdo;
}

function create_schema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            phone TEXT DEFAULT "",
            cpf TEXT DEFAULT "",
            address TEXT DEFAULT "",
            payment_method TEXT DEFAULT "",
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );
    $columns = array_column($pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('cpf', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN cpf TEXT DEFAULT ""');
    }
    if (!in_array('address', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN address TEXT DEFAULT ""');
    }
    if (!in_array('city', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN city TEXT DEFAULT ""');
    }
    if (!in_array('neighborhood', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN neighborhood TEXT DEFAULT ""');
    }
    if (!in_array('payment_method', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN payment_method TEXT DEFAULT ""');
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            descricao TEXT NOT NULL,
            custo_unit REAL NOT NULL DEFAULT 0,
            saldo TEXT DEFAULT "-",
            total TEXT DEFAULT "-",
            image_url TEXT DEFAULT "",
            categoria TEXT DEFAULT "outro",
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT "novo",
            payment_method TEXT NOT NULL DEFAULT "",
            customer_name TEXT NOT NULL DEFAULT "",
            customer_phone TEXT NOT NULL DEFAULT "",
            customer_address TEXT NOT NULL DEFAULT "",
            customer_city TEXT NOT NULL DEFAULT "",
            total_amount REAL NOT NULL DEFAULT 0,
            notes TEXT DEFAULT "",
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )'
    );
    $orderColumns = array_column($pdo->query("PRAGMA table_info(orders)")->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('payment_method', $orderColumns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT ""');
    }
    if (!in_array('customer_name', $orderColumns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN customer_name TEXT NOT NULL DEFAULT ""');
    }
    if (!in_array('customer_phone', $orderColumns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN customer_phone TEXT NOT NULL DEFAULT ""');
    }
    if (!in_array('customer_address', $orderColumns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN customer_address TEXT NOT NULL DEFAULT ""');
    }
    if (!in_array('customer_city', $orderColumns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN customer_city TEXT NOT NULL DEFAULT ""');
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 1,
            line_total REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS store_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            store_name TEXT NOT NULL DEFAULT "Casa das Rações Isa",
            phone TEXT NOT NULL DEFAULT "",
            email TEXT NOT NULL DEFAULT "",
            default_shipping REAL NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS store_cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            require_registration INTEGER NOT NULL DEFAULT 0
        )'
    );

    $pdo->exec(
        'INSERT OR IGNORE INTO store_settings (id, store_name, phone, email, default_shipping, updated_at)
         VALUES (1, "Casa das Rações Isa", "(18) 3743-4704", "contato@casadasracoes.local", 0, CURRENT_TIMESTAMP)'
    );
}

function seed_guest_user(PDO $pdo): void
{
    $email = 'visitante@casadasracoes.local';
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    if ($stmt->fetch()) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, phone, cpf, address, city, neighborhood, is_admin)
         VALUES (:name, :email, :password_hash, :phone, :cpf, :address, :city, :neighborhood, 0)'
    );
    $insert->execute([
        'name' => 'Visitante',
        'email' => $email,
        'password_hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
        'phone' => '',
        'cpf' => '',
        'address' => '',
        'city' => '',
        'neighborhood' => '',
    ]);
}

function seed_admin(PDO $pdo): void
{
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => 'admin@casadasracoes.local']);
    if ($stmt->fetch()) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, phone, is_admin)
         VALUES (:name, :email, :password_hash, :phone, 1)'
    );
    $insert->execute([
        'name' => 'Administrador',
        'email' => 'admin@casadasracoes.local',
        'password_hash' => password_hash('1234', PASSWORD_DEFAULT),
        'phone' => '(18) 3743-4704',
    ]);
}

function seed_products_from_json(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    if ($count > 0 || !is_file(SOURCE_PRODUCTS_JSON)) {
        return;
    }

    $raw = file_get_contents(SOURCE_PRODUCTS_JSON);
    if ($raw === false) {
        return;
    }

    $rows = json_decode($raw, true);
    if (!is_array($rows)) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT OR IGNORE INTO products (codigo, descricao, custo_unit, saldo, total, image_url, categoria, ativo, updated_at)
         VALUES (:codigo, :descricao, :custo_unit, :saldo, :total, :image_url, :categoria, 1, CURRENT_TIMESTAMP)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $codigo = trim((string) ($row['codigo'] ?? ''));
        $descricao = trim((string) ($row['descricao'] ?? ''));
        if ($codigo === '' || $descricao === '') {
            continue;
        }

        $insert->execute([
            'codigo' => $codigo,
            'descricao' => $descricao,
            'custo_unit' => parse_money_to_float((string) ($row['custo_unit'] ?? '0')),
            'saldo' => trim((string) ($row['saldo'] ?? '-')),
            'total' => trim((string) ($row['total'] ?? '-')),
            'image_url' => trim((string) ($row['image_url'] ?? '')),
            'categoria' => infer_category($descricao . ' ' . $codigo),
        ]);
    }
}

function parse_money_to_float(string $value): float
{
    $normalized = str_replace(['R$', ' '], '', trim($value));
    $normalized = str_replace('.', '', $normalized);
    $normalized = str_replace(',', '.', $normalized);
    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function infer_category(string $value): string
{
    $value = strtolower(remove_accents($value));
    if (preg_match('/\b(gato|gatos|felino|cat|feline)\b/u', $value)) {
        return 'gato';
    }
    if (preg_match('/\b(cao|caes|cachorro|cachorros|dog|canine)\b/u', $value)) {
        return 'cao';
    }
    return 'outro';
}

function remove_accents(string $value): string
{
    $map = [
        'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i',
        'ó' => 'o', 'ò' => 'o', 'õ' => 'o', 'ô' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u',
        'ç' => 'c',
    ];

    return strtr($value, $map);
}
