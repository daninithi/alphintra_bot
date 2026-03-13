package com.alphintra.auth.config;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

@Component
public class SchemaMigrationRunner {

    private final JdbcTemplate jdbcTemplate;

    public SchemaMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureUserColumns() {
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20)");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP");

        jdbcTemplate.execute("UPDATE users SET account_status = 'ACTIVE' WHERE account_status IS NULL");
        jdbcTemplate.execute("UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL");

        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN account_status SET DEFAULT 'ACTIVE'");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT FALSE");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN account_status SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL");

        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS login_history (" +
                        "  id BIGSERIAL PRIMARY KEY," +
                        "  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
                        "  login_at TIMESTAMP NOT NULL" +
                        ")");
        jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)");
    }
}
