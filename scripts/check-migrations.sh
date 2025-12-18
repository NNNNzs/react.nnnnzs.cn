#!/bin/bash

# 检查数据库迁移状态

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_DIR/docs/migrations"

DB_NAME="${DB_NAME:-react_blog}"
DB_USER="${DB_USER:-root}"
DB_HOST="${DB_HOST:-localhost}"

echo "========================================="
echo "数据库迁移状态检查"
echo "========================================="
echo ""

# 1. 检查数据库连接
echo -e "${BLUE}1. 数据库连接状态:${NC}"
if mysql -u "$DB_USER" -p -h "$DB_HOST" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
    echo -e "  ${GREEN}✓ 连接正常${NC}"
else
    echo -e "  ${RED}✗ 连接失败${NC}"
    exit 1
fi
echo ""

# 2. 检查迁移记录表
echo -e "${BLUE}2. 迁移记录表状态:${NC}"
TABLE_EXISTS=$(mysql -u "$DB_USER" -p -h "$DB_HOST" -N -e "
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = '$DB_NAME' 
AND table_name = 'tb_migration_history';
" "$DB_NAME" 2>/dev/null)

if [ "$TABLE_EXISTS" -eq 1 ]; then
    echo -e "  ${GREEN}✓ 表已存在${NC}"
    
    # 显示迁移统计
    TOTAL=$(mysql -u "$DB_USER" -p -h "$DB_HOST" -N -e "
    SELECT COUNT(*) FROM tb_migration_history WHERE status = 'success';
    " "$DB_NAME" 2>/dev/null)
    
    FAILED=$(mysql -u "$DB_USER" -p -h "$DB_HOST" -N -e "
    SELECT COUNT(*) FROM tb_migration_history WHERE status = 'failed';
    " "$DB_NAME" 2>/dev/null)
    
    echo "  总迁移数: $TOTAL"
    echo "  失败数: $FAILED"
else
    echo -e "  ${YELLOW}○ 表不存在（首次运行）${NC}"
fi
echo ""

# 3. 检查迁移文件
echo -e "${BLUE}3. 迁移文件状态:${NC}"
if [ -d "$MIGRATIONS_DIR" ]; then
    TOTAL_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
    echo "  迁移文件数: $TOTAL_FILES"
    
    if [ $TOTAL_FILES -gt 0 ]; then
        echo "  文件列表:"
        ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | while read file; do
            filename=$(basename "$file")
            size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
            echo "    - $filename (${size} bytes)"
        done
    fi
else
    echo -e "  ${RED}✗ 迁移目录不存在${NC}"
fi
echo ""

# 4. 检查待执行的迁移
echo -e "${BLUE}4. 待执行的迁移:${NC}"
if [ -d "$MIGRATIONS_DIR" ] && [ "$TABLE_EXISTS" -eq 1 ]; then
    EXECUTED=$(mysql -u "$DB_USER" -p -h "$DB_HOST" -N -e "
    SELECT migration_name FROM tb_migration_history WHERE status = 'success';
    " "$DB_NAME" 2>/dev/null)
    
    PENDING=()
    for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
        filename=$(basename "$file")
        if ! echo "$EXECUTED" | grep -q "$filename"; then
            PENDING+=("$filename")
        fi
    done
    
    if [ ${#PENDING[@]} -eq 0 ]; then
        echo -e "  ${GREEN}✓ 无待执行迁移${NC}"
    else
        echo -e "  ${YELLOW}发现 ${#PENDING[@]} 个待执行迁移:${NC}"
        for p in "${PENDING[@]}"; do
            echo "    ○ $p"
        done
    fi
else
    echo "  跳过"
fi
echo ""

# 5. 最近的迁移记录
echo -e "${BLUE}5. 最近的迁移记录:${NC}"
if [ "$TABLE_EXISTS" -eq 1 ]; then
    mysql -u "$DB_USER" -p -h "$DB_HOST" -t -e "
    SELECT 
        migration_name AS '迁移名称',
        executed_at AS '执行时间',
        execution_time AS '耗时(ms)',
        status AS '状态'
    FROM tb_migration_history
    ORDER BY executed_at DESC
    LIMIT 5;
    " "$DB_NAME" 2>/dev/null
else
    echo "  无记录"
fi
echo ""

# 6. 数据库表结构
echo -e "${BLUE}6. 数据库表结构:${NC}"
mysql -u "$DB_USER" -p -h "$DB_HOST" -t -e "
SELECT 
    table_name AS '表名',
    table_rows AS '行数',
    ROUND(data_length / 1024 / 1024, 2) AS '数据(MB)',
    ROUND(index_length / 1024 / 1024, 2) AS '索引(MB)'
FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
ORDER BY data_length DESC;
" "$DB_NAME" 2>/dev/null

echo ""
echo "========================================="
echo -e "${GREEN}检查完成！${NC}"
echo "========================================="

