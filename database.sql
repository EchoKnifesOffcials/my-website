-- database.sql - PostgreSQL schema for Bloxview

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    roblox_id BIGINT UNIQUE NOT NULL,
    roblox_username VARCHAR(50) NOT NULL,
    roblox_display_name VARCHAR(50),
    email VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50),
    verification_code VARCHAR(255),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    trust_score INT DEFAULT 500,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT
);

-- User inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    item_id INT NOT NULL,
    item_name VARCHAR(100),
    game VARCHAR(20),
    quantity INT DEFAULT 1,
    deposited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_id, game)
);

-- Deposits table
CREATE TABLE IF NOT EXISTS deposits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    item_id INT NOT NULL,
    item_name VARCHAR(100),
    quantity INT NOT NULL,
    transaction_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Verification attempts table (anti-bot)
CREATE TABLE IF NOT EXISTS verification_attempts (
    id BIGSERIAL PRIMARY KEY,
    roblox_id BIGINT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    attempt_count INT DEFAULT 1,
    last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE
);

-- Rate limiting logs
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id BIGSERIAL PRIMARY KEY,
    ip_address INET,
    endpoint VARCHAR(255),
    request_count INT,
    blocked BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_roblox_id ON users(roblox_id);
CREATE INDEX idx_users_verified ON users(verified);
CREATE INDEX idx_inventory_user_id ON user_inventory(user_id);
CREATE INDEX idx_deposits_user_id ON deposits(user_id);
CREATE INDEX idx_verification_attempts_roblox_id ON verification_attempts(roblox_id);
CREATE INDEX idx_rate_limit_logs_ip ON rate_limit_logs(ip_address);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
