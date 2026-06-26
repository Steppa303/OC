CREATE DATABASE gzpl_db;
\c gzpl_db;

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    article_number VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin user
CREATE USER gzpl_admin WITH PASSWORD 'secure_pass_123';
GRANT ALL PRIVILEGES ON DATABASE gzpl_db TO gzpl_admin;
GRANT ALL PRIVILEGES ON TABLE products TO gzpl_admin;
GRANT USAGE, SELECT ON SEQUENCE products_id_seq TO gzpl_admin;