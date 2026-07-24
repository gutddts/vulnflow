-- ============================================================
-- VulnFlow - PostgreSQL 初始化脚本
-- ============================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 创建审计模式
CREATE SCHEMA IF NOT EXISTS audit;

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit.log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit.log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit.log(changed_at DESC);

-- 审计触发器函数
CREATE OR REPLACE FUNCTION audit.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.log (table_name, operation, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.log (table_name, operation, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.log (table_name, operation, old_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), current_user);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建全文搜索配置
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'vulnflow_zh') THEN
        CREATE TEXT SEARCH CONFIGURATION vulnflow_zh (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION vulnflow_zh
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, simple;
    END IF;
END
$$;

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 输出初始化信息
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'VulnFlow PostgreSQL 初始化完成';
    RAISE NOTICE '============================================';
    RAISE NOTICE '已启用扩展: uuid-ossp, pgcrypto, pg_trgm, btree_gin, btree_gist, hstore';
    RAISE NOTICE '已创建模式: audit';
    RAISE NOTICE '已创建审计触发器函数: audit.audit_trigger()';
    RAISE NOTICE '============================================';
END
$$;
