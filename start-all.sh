#!/bin/bash

# 账户管理系统 macOS 启动脚本

# 默认参数
DB_USER="root"
DB_PASSWORD=""
DB_NAME="account_db"
BLACKLIST_BASE_URL="http://10.196.95.30:8081"
RESET_DB=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -ResetDb)
            RESET_DB=true
            shift
            ;;
        -DbUser)
            DB_USER="$2"
            shift 2
            ;;
        -DbPassword)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -DbName)
            DB_NAME="$2"
            shift 2
            ;;
        -BlacklistBaseUrl)
            BLACKLIST_BASE_URL="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# 设置错误处理
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_ROOT="$REPO_ROOT/frontend"
SCRIPTS_ROOT="$REPO_ROOT/scripts"
LOGS_ROOT="$REPO_ROOT/logs"

mkdir -p "$LOGS_ROOT"

# 颜色输出
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_step() {
    echo ""
    echo -e "${CYAN}==> $1${NC}"
}

# 查找 mysql
find_mysql() {
    if command -v mysql &> /dev/null; then
        echo "mysql"
    elif [ -f "/usr/local/mysql/bin/mysql" ]; then
        echo "/usr/local/mysql/bin/mysql"
    elif [ -f "/opt/homebrew/bin/mysql" ]; then
        echo "/opt/homebrew/bin/mysql"
    else
        echo "Error: mysql not found. Please install MySQL or add it to PATH." >&2
        exit 1
    fi
}

MYSQL_EXE=$(find_mysql)

# MySQL 连接参数（处理无密码情况）
mysql_conn_params() {
    if [ -z "$DB_PASSWORD" ]; then
        echo "-u $DB_USER --default-character-set=utf8mb4"
    else
        echo "-u $DB_USER --password=$DB_PASSWORD --default-character-set=utf8mb4"
    fi
}

# 执行 SQL 脚本
run_sql_file() {
    local database=$1
    local sql_file=$2
    
    if [ -z "$DB_PASSWORD" ]; then
        "$MYSQL_EXE" -u "$DB_USER" --default-character-set=utf8mb4 "$database" < "$sql_file"
    else
        "$MYSQL_EXE" -u "$DB_USER" --password="$DB_PASSWORD" --default-character-set=utf8mb4 "$database" < "$sql_file"
    fi
}

# 执行 SQL 查询
run_sql_query() {
    local database=$1
    local query=$2
    
    if [ -z "$DB_PASSWORD" ]; then
        "$MYSQL_EXE" -N -s -u "$DB_USER" --default-character-set=utf8mb4 "$database" -e "$query" 2>/dev/null || echo "0"
    else
        "$MYSQL_EXE" -N -s -u "$DB_USER" --password="$DB_PASSWORD" --default-character-set=utf8mb4 "$database" -e "$query" 2>/dev/null || echo "0"
    fi
}

# 检查数据库和初始化
ensure_database() {
    log_step "Checking database"
    
    # 创建数据库
    if [ -z "$DB_PASSWORD" ]; then
        "$MYSQL_EXE" -u "$DB_USER" --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS $DB_NAME DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci;"
    else
        "$MYSQL_EXE" -u "$DB_USER" --password="$DB_PASSWORD" --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS $DB_NAME DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci;"
    fi
    
    # 检查 staff 表
    staff_table_exists=$(run_sql_query "information_schema" "SELECT COUNT(*) FROM tables WHERE table_schema = '$DB_NAME' AND table_name = 'staff';")
    staff_count="0"
    
    if [ "$staff_table_exists" = "1" ]; then
        staff_count=$(run_sql_query "$DB_NAME" "SELECT COUNT(*) FROM staff;")
    fi
    
    if [ "$RESET_DB" = true ] || [ "$staff_table_exists" != "1" ] || [ "$staff_count" = "0" ]; then
        echo -e "${YELLOW}Initializing database schema and seed data...${NC}"
        run_sql_file "$DB_NAME" "$SCRIPTS_ROOT/mysql_schema_current.sql"
        run_sql_file "$DB_NAME" "$SCRIPTS_ROOT/mysql_seed_smoke.sql"
    else
        echo -e "${GREEN}Database already has base data. Skip init.${NC}"
    fi
}

# 等待端口
wait_for_port() {
    local port=$1
    local timeout=${2:-60}
    local deadline=$(($(date +%s) + timeout))
    
    while [ $(date +%s) -lt $deadline ]; do
        if nc -z localhost "$port" 2>/dev/null; then
            return 0
        fi
        sleep 2
    done
    
    echo "Error: Timed out waiting for port $port" >&2
    return 1
}

# 等待 HTTP 服务
wait_for_http() {
    local url=$1
    local timeout=${2:-60}
    local deadline=$(($(date +%s) + timeout))
    
    while [ $(date +%s) -lt $deadline ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    
    echo "Error: Timed out waiting for $url" >&2
    return 1
}

# 启动后端
start_backend() {
    log_step "Starting backend"
    
    if nc -z localhost 8080 2>/dev/null; then
        echo -e "${GREEN}Backend already listening on 8080.${NC}"
        return 0
    fi
    
    cd "$REPO_ROOT"
    export ACCOUNT_DB_USERNAME="$DB_USER"
    export ACCOUNT_DB_PASSWORD="$DB_PASSWORD"
    export ACCOUNT_BLACKLIST_BASE_URL="$BLACKLIST_BASE_URL"
    
    nohup mvn spring-boot:run > "$LOGS_ROOT/backend.log" 2>&1 &
    
    wait_for_port 8080 90
    echo -e "${GREEN}Backend started successfully${NC}"
}

# 启动前端
start_frontend() {
    log_step "Starting frontend"
    
    if nc -z localhost 5173 2>/dev/null; then
        echo -e "${GREEN}Frontend already listening on 5173.${NC}"
        return 0
    fi
    
    cd "$FRONTEND_ROOT"
    export VITE_TRADE_MANAGEMENT_API_BASE="$BLACKLIST_BASE_URL/api/trade-management"
    
    nohup npm run dev -- --host 0.0.0.0 > "$LOGS_ROOT/frontend.log" 2>&1 &
    
    wait_for_http "http://localhost:5173/login" 90
    echo -e "${GREEN}Frontend started successfully${NC}"
}

# 停止函数
cleanup() {
    echo ""
    echo "Stopping services..."
    pkill -f "spring-boot:run" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# 主流程
log_step "Checking MySQL"
if [ -z "$DB_PASSWORD" ]; then
    if ! "$MYSQL_EXE" -u "$DB_USER" -e "SELECT 1;" > /dev/null 2>&1; then
        echo "Error: Cannot connect to MySQL. Please ensure MySQL is running." >&2
        echo "You can start it with: brew services start mysql" >&2
        exit 1
    fi
else
    if ! "$MYSQL_EXE" -u "$DB_USER" --password="$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1; then
        echo "Error: Cannot connect to MySQL. Please ensure MySQL is running." >&2
        echo "You can start it with: brew services start mysql" >&2
        exit 1
    fi
fi
echo -e "${GREEN}MySQL is running${NC}"

ensure_database
start_backend
start_frontend

log_step "All services are ready"
echo -e "${GREEN}Backend : http://localhost:8080${NC}"
echo -e "${GREEN}Frontend: http://localhost:5173/login${NC}"
echo -e "${GREEN}Database: mysql://localhost:3306/$DB_NAME${NC}"
echo -e "${GREEN}Blacklist: $BLACKLIST_BASE_URL${NC}"
echo -e "${GREEN}Backend log : $LOGS_ROOT/backend.log${NC}"
echo -e "${GREEN}Frontend log: $LOGS_ROOT/frontend.log${NC}"
echo ""
echo "Press Ctrl+C to stop all services"

# 保持运行
while true; do
    sleep 1
done