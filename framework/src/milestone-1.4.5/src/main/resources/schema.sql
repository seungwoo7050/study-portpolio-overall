-- Schema for H2 in-memory database
-- Mirrors the InMemoryDatabase structure from mini-spring

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

-- Insert sample data (similar to mini-spring initial state)
INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@example.com');
INSERT INTO users (id, name, email) VALUES ('2', 'Bob', 'bob@example.com');
