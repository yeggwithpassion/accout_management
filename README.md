# 账户业务子系统后端

本仓库是证券账户与资金账户子系统的后端实现，当前统一维护 `src/` 这一套代码。

当前约定如下：

- 接口统一使用 `/api/...`，不再保留 `/api/v1/...`
- 不维护本地 `blacklist` 表，黑名单通过外部桥接校验
- 不维护本地 `freeze_record` 表
- 不做 RBAC / permission 体系
- 业务顺序为先开证券账户，再开资金账户；资金账户创建后自动绑定证券账户
- 投资者侧通过本系统签发 `auth_token`
- 工作人员侧通过本系统签发 `X-Staff-Auth-Token`
- 交易回调采用“交易号 + 动作类型 + 金额/数量”的模型，本系统自行落资金流水和持仓变动日志

## 1. 代码结构

### 1.1 顶层目录

- `src/`：主代码与测试代码
- `scripts/`：数据库建表、视图、测试数据、可选存储过程，以及 MySQL 冒烟/现行 schema 脚本
- `docs/`：设计文档、测试文档、实验大纲等补充材料
- `pom.xml`：Maven 构建配置

说明：

- 原始核心脚本仍是 4 个：`01_create_tables.sql`、`02_views.sql`、`03_test_data.sql`、`04_optional_procedures.sql`
- 后来新增的 `mysql_schema_current.sql` 和 `mysql_seed_smoke.sql` 是为了真实 MySQL 建库/冒烟测试补的辅助脚本，不是替代原来的 4 个

### 1.2 主代码结构

`src/main/java/account/` 主要目录如下：

- `common/`：统一返回体、错误码、业务异常、请求头常量
- `config/`：Spring 配置与 DAO 装配
- `controller/`：HTTP 接口入口
- `dao/`：数据库访问层
- `dto/`：请求/响应 DTO
- `enums/`：对外状态枚举
- `exception/`：全局异常处理
- `integration/`：外部系统桥接，如黑名单桥接
- `service/`：业务实现
- `service/api/`：服务接口定义

### 1.3 Controller 分层

`src/main/java/account/controller/internal/`

- `StaffController`：工作人员登录、停用工作人员
- `FundAccountController`：资金账户内部接口
- `SecurityAccountController`：证券账户内部接口、投资者信息修改

`src/main/java/account/controller/external/`

- `ExternalFundController`：投资者资金登录、查询、改密
- `ExternalSecurityController`：投资者持仓查询
- `ExternalTradeController`：中央交易系统回调接口
- `AdminController`：管理员接口入口
- `AuditController`：审计接口入口

说明：

- 目前 `AdminController` / `AuditController` 代码仍保留，但不属于当前已完成联调范围

### 1.4 Service 分层

`src/main/java/account/service/api/`

- `FundAccountService`
- `SecurityAccountService`
- `StaffService`
- `ClientAuthTokenService`
- `StaffAuthTokenService`
- `AdminService`
- `AuditService`

`src/main/java/account/service/`

- `FundAccountServiceImpl`：资金开户、存取款、改密、挂失、补办、销户、绑定解绑、资金查询、资金回调
- `SecurityAccountServiceImpl`：证券开户、挂失、补办、销户、投资者信息修改、持仓查询、持仓回调
- `StaffServiceImpl`：工作人员登录、停用
- `InMemoryClientAuthTokenService`：投资者 token 签发与校验
- `InMemoryStaffAuthTokenService`：工作人员 token 签发与校验
- `AdminServiceImpl`、`AuditServiceImpl`：保留实现

### 1.5 测试代码结构

`src/test/java/account/`

- `dao/DaoIntegrationTest.java`：DAO 层集成测试
- `service/AccountWorkflowServiceTest.java`：业务流程测试
- `service/AccountBusinessRuleTest.java`：业务规则测试
- `service/ClientAuthTokenServiceTest.java`：投资者 token 测试
- `service/FundLogViewCompositionTest.java`：资金流水与持仓变动拼装测试
- `integration/ApiIntegrationTest.java`：H2 + MockMvc 接口集成测试
- `integration/BlacklistSupportTest.java`：黑名单桥接测试
- `integration/RealMySqlIntegrationTest.java`：真实 MySQL 集成测试
- `support/TestDatabaseSupport.java`：测试建库与测试数据支持
- `support/RealMySqlTestSupport.java`：真实 MySQL 测试支持

## 2. 数据库字段、数据类型与关系

主要脚本：

- `scripts/01_create_tables.sql`
- `scripts/02_views.sql`
- `scripts/03_test_data.sql`
- `scripts/04_optional_procedures.sql`
- `scripts/mysql_schema_current.sql`
- `scripts/mysql_seed_smoke.sql`

### 2.1 关系概览

```text
investor 1 --- n security_account
security_account 1 --- 0..1 fund_account
security_account 1 --- n holding
security_account 1 --- n holding_change_log
fund_account 1 --- n fund_transaction_log
staff 1 --- n operation_log
staff 1 --- n fund_transaction_log

security_account.linked_fund_acc -> fund_account.fund_acc_no
fund_account.sec_acc_no          -> security_account.sec_acc_no
```

### 2.2 表结构

#### investor

投资者主数据表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `investor_id` | `INT` | PK, AUTO_INCREMENT | 投资者主键 |
| `type` | `VARCHAR(20)` | NOT NULL | 投资者类型 |
| `name` | `VARCHAR(100)` | NOT NULL | 姓名或法人名称 |
| `gender` | `VARCHAR(10)` | NULL | 性别 |
| `id_type` | `VARCHAR(20)` | NOT NULL | 证件类型 |
| `id_number` | `VARCHAR(50)` | NOT NULL, UNIQUE | 证件号码 |
| `phone` | `VARCHAR(20)` | NULL | 电话 |
| `address` | `VARCHAR(200)` | NULL | 地址 |
| `work_unit` | `VARCHAR(100)` | NULL | 工作单位 |
| `occupation` | `VARCHAR(50)` | NULL | 职业 |
| `education` | `VARCHAR(50)` | NULL | 学历 |
| `legal_number` | `VARCHAR(20)` | NULL | 法人编号 |
| `business_license` | `VARCHAR(20)` | NULL | 营业执照号 |
| `authorize_name` | `VARCHAR(20)` | NULL | 授权代理人姓名 |
| `authorize_phone` | `VARCHAR(20)` | NULL | 授权代理人电话 |
| `authorize_address` | `VARCHAR(100)` | NULL | 授权代理人地址 |
| `executor_name` | `VARCHAR(50)` | NULL | 经办人姓名 |
| `agent_name` | `VARCHAR(100)` | NULL | 代理人姓名 |
| `agent_id_number` | `VARCHAR(50)` | NULL | 代理人证件号 |
| `created_at` | `DATETIME` | NOT NULL | 创建时间 |

#### staff

工作人员账户表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `staff_id` | `INT` | PK | 工作人员主键 |
| `username` | `VARCHAR(50)` | NOT NULL, UNIQUE | 登录名 |
| `password_hash` | `VARCHAR(128)` | NOT NULL | 密码哈希 |
| `status` | `VARCHAR(20)` | NOT NULL | 账户状态 |
| `created_at` | `DATETIME` | NOT NULL | 创建时间 |

说明：

- 工作人员离职采用逻辑停用，不做物理删除
- 原因是 `operation_log` 与 `fund_transaction_log` 需要保留审计引用

#### security_account

证券账户主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `sec_acc_no` | `VARCHAR(20)` | PK | 证券账户号 |
| `investor_id` | `INT` | NOT NULL, FK | 所属投资者 |
| `status` | `VARCHAR(20)` | NOT NULL | 账户状态 |
| `open_date` | `DATE` | NOT NULL | 开户日期 |
| `linked_fund_acc` | `VARCHAR(20)` | NULL, UNIQUE, FK | 绑定资金账户号 |

#### fund_account

资金账户主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `fund_acc_no` | `VARCHAR(20)` | PK | 资金账户号 |
| `sec_acc_no` | `VARCHAR(20)` | NULL, UNIQUE, FK | 绑定证券账户号 |
| `trade_password` | `VARCHAR(128)` | NOT NULL | 交易密码哈希 |
| `withdraw_password` | `VARCHAR(128)` | NOT NULL | 取款密码哈希 |
| `available_balance` | `DECIMAL(15,2)` | NOT NULL | 可用余额 |
| `frozen_balance` | `DECIMAL(15,2)` | NOT NULL | 冻结余额 |
| `currency` | `CHAR(3)` | NOT NULL | 币种 |
| `status` | `VARCHAR(20)` | NOT NULL | 账户状态 |
| `open_date` | `DATE` | NOT NULL | 开户日期 |
| `last_interest_date` | `DATE` | NULL | 上次结息日期 |
| `annual_interest_rate` | `DECIMAL(5,4)` | NOT NULL | 年利率 |

#### fund_transaction_log

资金流水表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `log_id` | `BIGINT` | PK, AUTO_INCREMENT | 流水主键 |
| `fund_acc_no` | `VARCHAR(20)` | NOT NULL, FK | 资金账户号 |
| `txn_type` | `VARCHAR(20)` | NOT NULL | 资金变动类型 |
| `amount` | `DECIMAL(15,2)` | NOT NULL | 本次变动金额 |
| `available_after` | `DECIMAL(15,2)` | NOT NULL | 变动后可用余额 |
| `frozen_after` | `DECIMAL(15,2)` | NOT NULL | 变动后冻结余额 |
| `ref_order_id` | `VARCHAR(50)` | NULL | 关联交易号 |
| `operator_id` | `INT` | NULL, FK | 柜台操作工作人员 |
| `txn_time` | `DATETIME` | NOT NULL | 流水时间 |

#### holding

当前持仓表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `holding_id` | `BIGINT` | PK, AUTO_INCREMENT | 持仓主键 |
| `sec_acc_no` | `VARCHAR(20)` | NOT NULL, FK | 证券账户号 |
| `stock_code` | `VARCHAR(10)` | NOT NULL | 股票代码 |
| `stock_name` | `VARCHAR(100)` | NOT NULL | 股票名称 |
| `quantity` | `INT` | NOT NULL | 总持仓 |
| `frozen_quantity` | `INT` | NOT NULL | 冻结股数 |
| `avg_cost` | `DECIMAL(15,4)` | NULL | 持仓均价 |
| `updated_at` | `DATETIME` | NOT NULL | 更新时间 |

唯一约束：

- `(sec_acc_no, stock_code)` 唯一

#### holding_change_log

持仓变动日志表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `log_id` | `BIGINT` | PK, AUTO_INCREMENT | 日志主键 |
| `sec_acc_no` | `VARCHAR(20)` | NOT NULL, FK | 证券账户号 |
| `stock_code` | `VARCHAR(10)` | NOT NULL | 股票代码 |
| `stock_name` | `VARCHAR(100)` | NOT NULL | 股票名称 |
| `ref_order_id` | `VARCHAR(50)` | NOT NULL | 关联交易号 |
| `change_type` | `VARCHAR(20)` | NOT NULL | 持仓变化类型 |
| `quantity` | `INT` | NOT NULL | 本次变动股数 |
| `price` | `DECIMAL(15,4)` | NULL | 成交价格 |
| `quantity_after` | `INT` | NOT NULL | 变动后总持仓 |
| `frozen_quantity_after` | `INT` | NOT NULL | 变动后冻结持仓 |
| `avg_cost_after` | `DECIMAL(15,4)` | NULL | 变动后均价 |
| `txn_time` | `DATETIME` | NOT NULL | 变动时间 |

#### operation_log

工作人员操作日志表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `log_id` | `BIGINT` | PK, AUTO_INCREMENT | 日志主键 |
| `staff_id` | `INT` | NOT NULL, FK | 工作人员编号 |
| `operation_type` | `VARCHAR(50)` | NOT NULL | 操作类型 |
| `target_type` | `VARCHAR(50)` | NULL | 目标对象类型 |
| `target_id` | `VARCHAR(50)` | NULL | 目标对象编号 |
| `detail` | `VARCHAR(500)` | NULL | 详情 |
| `operation_time` | `DATETIME` | NOT NULL | 操作时间 |

### 2.3 视图

`scripts/02_views.sql` 当前定义了以下视图：

- `v_fund_account_simple`
- `v_holding_available`
- `v_investor_basic`

### 2.4 当前不维护的表

- `blacklist`
- `freeze_record`
- RBAC / permission 相关表

## 3. 外部接口

外部接口分为两类：

- 投资者客户端接口
- 中央交易系统回调接口

统一返回格式：

```json
{
  "code": 0,
  "message": "成功"
}
```

成功时会在同层追加业务字段；失败时通过 `code`、`symbol`、`message` 表示错误。

### 3.1 投资者认证

投资者先调用：

- `POST /api/external/fund/login`

成功后由本系统签发 `auth_token`。后续资金查询、持仓查询、投资者改密都使用该 token。

### 3.2 外部接口总表

| 接口名 | 方法 | 路径 | 鉴权 | 关键请求字段 | 关键响应字段 |
|---|---|---|---|---|---|
| `clientLoginAuth` | `POST` | `/api/external/fund/login` | 无 | `fund_acc_no`, `trade_password` | `auth_token`, `fund_acc_no`, `sec_acc_no`, `status` |
| `getFundSnapshot` | `GET` | `/api/external/fund/snapshot` | `auth_token` | `fund_acc_no`, `auth_token` | `available_balance`, `frozen_balance`, `currency`, `status`, `recent_logs` |
| `clientChangeFundPassword` | `PUT` | `/api/external/fund/password` | `auth_token` | `fund_acc_no`, `auth_token`, `password_type`, `old_password`, `new_password` | `code`, `message` |
| `getSecuritySnapshot` | `GET` | `/api/external/security/snapshot` | `auth_token` | `sec_acc_no`, `auth_token`, `stock_code` 可选 | 单只持仓或全持仓数据 |
| `updateFundBalance` | `POST` | `/api/external/trade/fund-balance` | 当前未做独立系统签名 | `fund_acc_no`, `ref_order_id`, `txn_type`, `amount` | `available_balance`, `frozen_balance`, `log_id`, `duplicate` |
| `updateSecurityHolding` | `POST` | `/api/external/trade/security-holding` | 当前未做独立系统签名 | `sec_acc_no`, `stock_code`, `stock_name`, `ref_order_id`, `change_type`, `quantity`, `price` | `log_id`, `duplicate`, `quantity`, `frozen_quantity`, `available_quantity`, `avg_cost` |

### 3.3 关键外部接口语义

#### `POST /api/external/fund/login`

请求示例：

```json
{
  "fund_acc_no": "FA2026000001",
  "trade_password": "123456"
}
```

#### `GET /api/external/fund/snapshot`

请求参数：

- `fund_acc_no`
- `auth_token`

返回重点：

- 资金余额
- 资金状态
- 最近资金流水
- 如果资金流水带 `ref_order_id`，系统会尝试拼上关联持仓变化信息

#### `PUT /api/external/fund/password`

`password_type` 允许值：

- `trade`
- `withdraw`

#### `GET /api/external/security/snapshot`

请求参数：

- `sec_acc_no`
- `auth_token`
- `stock_code` 可选

若带 `stock_code`，返回单只证券持仓；否则返回 `holdings` 数组。

#### `POST /api/external/trade/fund-balance`

语义：交易系统通知资金变化，本系统更新资金账户并写入资金流水。

请求示例：

```json
{
  "fund_acc_no": "FA2026000001",
  "ref_order_id": "ORD-20260619-001",
  "txn_type": "买入冻结",
  "amount": 1000.00
}
```

`txn_type` 允许值：

- `买入冻结`
- `买入扣款`
- `卖出回款`
- `撤单解冻`

幂等键：

- `ref_order_id + txn_type`

#### `POST /api/external/trade/security-holding`

语义：交易系统通知持仓变化，本系统更新当前持仓并写入持仓变动日志。

请求示例：

```json
{
  "sec_acc_no": "SA2026000001",
  "stock_code": "600519",
  "stock_name": "贵州茅台",
  "ref_order_id": "ORD-20260619-001",
  "change_type": "买入增加",
  "quantity": 100,
  "price": 1500.0000
}
```

`change_type` 允许值：

- `买入增加`
- `卖出冻结`
- `卖出扣减`
- `撤单释放`

幂等键：

- `ref_order_id + change_type + sec_acc_no + stock_code`

### 3.4 外部交易与日志关联

资金流水和持仓变化通过 `ref_order_id` 关联。

同一笔交易通常会留下两侧事实：

- `fund_transaction_log.ref_order_id = ORD-...`
- `holding_change_log.ref_order_id = ORD-...`

## 4. 内部接口

内部接口分为三类：

- 工作人员登录
- 柜台业务接口
- 管理员 / 审计接口

### 4.1 鉴权

工作人员先调用：

- `POST /api/internal/staff/login`

成功后拿到 `auth_token`，后续内部接口统一通过请求头传：

```http
X-Staff-Auth-Token: <token>
```

说明：

- 请求体中的 `staff_id`、`operator_staff_id` 最终由服务端回填
- 服务端真实身份来自 `X-Staff-Auth-Token`

### 4.2 内部接口总表

| 接口名 | 方法 | 路径 | 鉴权 | 关键请求字段 | 关键响应字段 |
|---|---|---|---|---|---|
| `staffLogin` | `POST` | `/api/internal/staff/login` | 无 | `username`, `password` | `staff_id`, `username`, `status`, `auth_token` |
| `deactivateStaff` | `POST` | `/api/internal/staff/deactivate` | `X-Staff-Auth-Token` | `target_staff_id`, `reason` | `staff_id`, `username`, `status` |
| `createFundAccount` | `POST` | `/api/internal/fund/accounts` | `X-Staff-Auth-Token` | `sec_acc_no`, `id_number`, `trade_password`, `withdraw_password`, `currency` | `fund_acc_no`, `status`, `sec_acc_no`, `currency` |
| `deposit` | `POST` | `/api/internal/fund/deposit` | `X-Staff-Auth-Token` | `fund_acc_no`, `amount` | `available_balance`, `log_id` |
| `withdraw` | `POST` | `/api/internal/fund/withdraw` | `X-Staff-Auth-Token` | `fund_acc_no`, `amount`, `withdraw_password` | `available_balance`, `log_id` |
| `changeFundPassword` | `PUT` | `/api/internal/fund/password` | `X-Staff-Auth-Token` | `fund_acc_no`, `password_type`, `old_password`, `new_password` | `code`, `message` |
| `reportFundLoss` | `POST` | `/api/internal/fund/accounts/loss` | `X-Staff-Auth-Token` | `fund_acc_no`, `id_number`, `reason` | `status` |
| `reissueFundAccount` | `POST` | `/api/internal/fund/accounts/reissue` | `X-Staff-Auth-Token` | `old_fund_acc_no`, `id_number`, `new_trade_password`, `new_withdraw_password` | `new_fund_acc_no`, `old_fund_acc_no` |
| `closeFundAccount` | `POST` | `/api/internal/fund/accounts/close` | `X-Staff-Auth-Token` | `fund_acc_no`, `id_number`, `reason` | `status` |
| `bindSecurityAccount` | `POST` | `/api/internal/fund/accounts/bind` | `X-Staff-Auth-Token` | `fund_acc_no`, `sec_acc_no` | `fund_acc_no`, `sec_acc_no` |
| `unbindSecurityAccount` | `POST` | `/api/internal/fund/accounts/unbind` | `X-Staff-Auth-Token` | `fund_acc_no`, `sec_acc_no` | `fund_acc_no`, `sec_acc_no` |
| `queryFundInfo` | `GET` | `/api/internal/fund/accounts` | `X-Staff-Auth-Token` | `fund_acc_no`, `id_number`, `include_logs` | `fund_acc_no`, `available_balance`, `frozen_balance`, `currency`, `status`, `logs` |
| `createSecurityAccount` | `POST` | `/api/internal/security/accounts` | `X-Staff-Auth-Token` | `investor_type`, `name`, `gender`, `id_type`, `id_number` 及投资者信息字段 | `sec_acc_no`, `status`, `investor_id` |
| `updateInvestorInfo` | `PUT` | `/api/internal/security/investors` | `X-Staff-Auth-Token` | `investor_id` 及可修改字段 | 投资者更新后的字段 |
| `reportSecurityLoss` | `POST` | `/api/internal/security/accounts/loss` | `X-Staff-Auth-Token` | `sec_acc_no`, `id_number`, `reason` | `status` |
| `reissueSecurityAccount` | `POST` | `/api/internal/security/accounts/reissue` | `X-Staff-Auth-Token` | `old_sec_acc_no`, `id_number` | `new_sec_acc_no`, `old_sec_acc_no` |
| `closeSecurityAccount` | `POST` | `/api/internal/security/accounts/close` | `X-Staff-Auth-Token` | `sec_acc_no`, `id_number`, `reason` | `status` |
| `settleAnnualInterest` | `POST` | `/api/admin/fund/settle-annual-interest` | `X-Staff-Auth-Token` | `year_rate` 可选 | `total_accounts`, `total_interest` |
| `adminFreezeAccount` | `POST` | `/api/admin/accounts/freeze` | `X-Staff-Auth-Token` | `account_type`, `account_no`, `freeze_type`, `reason` | `code`, `message` |
| `adminUnfreezeAccount` | `POST` | `/api/admin/accounts/unfreeze` | `X-Staff-Auth-Token` | `account_type`, `account_no`, `freeze_type` | `code`, `message` |
| `adminGetAccountDetails` | `GET` | `/api/admin/accounts/{account_no}` | `X-Staff-Auth-Token` | `account_no` | 账户详情 |
| `adminCloseSecurityAccount` | `POST` | `/api/admin/security/force-close` | `X-Staff-Auth-Token` | `security_account_no`, `force_reason` | `code`, `message` |
| `queryOperationLog` | `GET` | `/api/admin/audit/operation-logs` | `X-Staff-Auth-Token` | `staff_id`、`time_from`、`time_to`、`operation_type`、`target_type`、`target_id` | `logs`, `total` |

### 4.3 当前已实现的关键内部语义

#### 工作人员停用

- 逻辑停用，不做物理删除
- 停用后原有工作人员 token 立即失效
- 会写入 `operation_log`

#### 证券开户

- 当前正式支持个人开户
- 未成年人禁止开户
- 当前证件校验按 18 位身份证处理
- 黑名单通过外部桥接校验
- 会创建 `investor` 与 `security_account`
- 会写入 `operation_log`

#### 资金开户

- 必须基于已存在证券账户开户
- 身份证号必须与证券账户持有人一致
- 创建后自动与证券账户绑定
- 若证券账户之前因"无资金账户"被冻结，绑定后恢复正常
- 会写入 `operation_log`

#### 存取款

- 修改 `fund_account`
- 写入 `fund_transaction_log`
- 写入 `operation_log`

#### 挂失与补办

- 资金挂失会联动冻结关联证券账户
- 资金补办会生成新资金账户，并让旧投资者 token 失效
- 证券补办会复制持仓，并把资金账户重新挂到新证券账户

#### 销户与解绑

- 证券销户前必须无持仓
- 资金销户前必须无可用余额、无冻结余额
- 资金解绑或销户后，证券账户进入"无资金账户冻结"

### 4.4 当前未纳入完成范围的接口

- `AdminController` 与 `AuditController` 所对应能力当前不作为"已完成联调范围"
- 代码保留，但本次后端验收主范围是账户业务主流程

## 5. 错误码

定义位置：

- `src/main/java/account/common/ErrorCode.java`

### 5.1 错误码总表

| code | symbol | 含义 |
|---|---|---|
| `0` | `OK` | 成功 |
| `1001` | `ERR_001` | 余额不足 |
| `1002` | `ERR_002` | 持仓不足 |
| `1003` | `ERR_003` | 账户已冻结 |
| `1004` | `ERR_004` | 密码错误 |
| `1005` | `ERR_005` | 证券账户不存在 |
| `1006` | `ERR_006` | 该投资者已有其他证券账户 |
| `1007` | `ERR_007` | 资金账户仍有余额或冻结资金，不允许当前操作 |
| `1008` | `ERR_008` | 证券账户未关联当前资金账户 |
| `1009` | `ERR_009` | 工作人员认证失败 |
| `1010` | `ERR_010` | 账户不存在 |
| `1011` | `ERR_011` | 账户已是请求状态 |
| `1012` | `ERR_012` | 投资者在黑名单中 |
| `1013` | `ERR_013` | 账户持有人与证件不一致 |
| `1014` | `ERR_014` | 绑定关系冲突 |
| `1015` | `ERR_015` | 资金账户未绑定符合要求的证券账户 |
| `1016` | `ERR_016` | 资金账户存在未成交委托单 |
| `1017` | `ERR_017` | 资金账户处于冻结状态，不允许当前操作 |
| `1018` | `ERR_018` | 认证令牌无效或已失效 |
| `1019` | `ERR_019` | 开户资格不符合 |
| `1020` | `ERR_020` | 证件类型或证件号码不合法 |
| `1021` | `ERR_021` | 当前账户状态不允许执行该操作 |
| `1022` | `ERR_022` | 证券账户仍有持仓，无法销户 |
| `4000` | `ERR_PARAM` | 参数校验失败 |
| `5000` | `ERR_SYS` | 系统内部错误 |

### 5.2 常见映射

- `ERR_001`：可用余额不足、冻结资金不足
- `ERR_002`：可卖持仓不足、冻结持仓不足
- `ERR_003`：账户被冻结，禁止继续操作
- `ERR_004`：交易密码或取款密码错误
- `ERR_005` / `ERR_010`：账户不存在
- `ERR_012`：黑名单桥接校验失败
- `ERR_014` / `ERR_015`：绑定关系不满足
- `ERR_018`：投资者或工作人员 token 失效
- `ERR_019`：开户资格不满足，例如未成年人
- `ERR_020`：证件类型或号码不合法
- `ERR_021`：账户状态冲突，例如已销户、非挂失状态补办
- `ERR_022`：证券账户仍有持仓，不能销户

### 5.3 当前说明

- `ERR_008` 当前基本未实际使用
- `ERR_016` 当前基本未实际使用，因为本系统未单独维护"未成交委托单"表
- `ERR_013` 同时覆盖"投资者不存在"和"持有人身份不匹配"两类场景

## 6. 测试

### 6.1 测试范围

当前测试覆盖以下层次：

- DAO 层
- Service 层
- HTTP 接口层
- 黑名单桥接
- 真实 MySQL 集成测试

### 6.2 已覆盖的主要业务场景

- 证券开户、资金开户
- 投资者信息修改
- 存款、取款、内部改密、外部改密
- 投资者登录与 token 鉴权
- 资金快照、持仓快照、资金信息查询
- 资金挂失、资金补办、证券挂失、证券补办
- 资金销户、绑定、解绑
- 外部交易回调：资金变化、持仓变化
- 幂等：重复回调不会重复落账
- 工作人员停用及 token 失效
- 未成年人开户失败
- 错误密码、非法参数、无效 token
- SQL 注入载荷
- XSS 载荷

### 6.3 测试文件说明

- `DaoIntegrationTest`：验证 DAO 增删改查、事务回滚、日志查询
- `AccountWorkflowServiceTest`：验证核心业务流程和并发幂等
- `AccountBusinessRuleTest`：验证业务规则与状态流转
- `ClientAuthTokenServiceTest`：验证投资者 token 签发、校验、失效
- `FundLogViewCompositionTest`：验证资金流水与持仓日志拼装
- `ApiIntegrationTest`：H2 + MockMvc 下的接口主流程与异常流程
- `BlacklistSupportTest`：验证黑名单 HTTP 桥接
- `RealMySqlIntegrationTest`：真实 MySQL 下的主流程、异常流程、注入/XSS、状态流转、幂等

### 6.4 测试命令

本地全量测试：

```bash
mvn clean test
```

仅跑真实 MySQL 集成测试：

```bash
mvn -Dtest=RealMySqlIntegrationTest test
```

### 6.5 真实 MySQL 测试说明

真实 MySQL 测试默认约定：

- Host：`localhost`
- Port：`3306`
- Username：通过 `account.test.mysql.username` 传入
- Password：通过 `account.test.mysql.password` 传入

说明：

- 每个真实 MySQL 测试方法会创建独立测试库，避免互相删库冲突
- 真实测试已实际跑通
- 真实测试过程中修复过一个真实约束问题：证券账户补办时 `linked_fund_acc` 唯一约束冲突

启动示例：

```bash
mvn -Dtest=RealMySqlIntegrationTest ^
    -Daccount.test.mysql.username=your_user ^
    -Daccount.test.mysql.password=your_password test
```

### 6.6 当前结论

当前后端范围内，以下结论已经确认：

- `mvn -q clean test` 通过
- 真实 MySQL 集成测试通过
- 主体后端逻辑可进入联调阶段

当前不在这次"彻底完成"范围内的内容：

- 前端联调
- 与其他组真实系统联调
- `Admin` / `Audit` 的正式交付验收

## 7. 前端部分

前端代码位于 `frontend/` 目录，是一个基于 React + TypeScript + Vite 的 SPA 应用。

### 7.1 前端结构

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/ui/     # UI组件库
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx       # 管理员仪表盘
│   │   │   ├── FundAccounts.tsx    # 资金账户管理
│   │   │   ├── SecuritiesAccounts.tsx  # 证券账户管理
│   │   │   ├── Login.tsx           # 登录页面
│   │   │   └── user/               # 用户端页面
│   │   │       ├── UserDashboard.tsx   # 投资者账户查询
│   │   │       └── Transfer.tsx        # 银证转账
│   │   ├── lib/
│   │   │   └── api.ts         # API封装，对接Java后端
│   │   └── routes.tsx         # 路由配置
│   └── styles/                # 样式文件
├── index.html
├── package.json
└── vite.config.ts
```

### 7.2 前端与后端的对接

前端 `api.ts` 已配置对接本Java后端：

- **API_BASE**: `/api` - 由 Vite 代理到 `http://localhost:8080` 的账户业务子系统
- **TRADE_MANAGEMENT_API_BASE**: `http://localhost:8081/api/trade-management` - 交易管理系统（黑名单服务）

#### 7.2.1 外部接口（投资者端）

| 功能 | 前端方法 | 后端接口 |
|------|---------|---------|
| 登录 | `userLogin()` | `POST /api/external/fund/login` |
| 资金查询 | `getFundSnapshot()` | `GET /api/external/fund/snapshot` |
| 持仓查询 | `getSecuritySnapshot()` | `GET /api/external/security/snapshot` |
| 修改密码 | `changePassword()` | `PUT /api/external/fund/password` |

#### 7.2.2 内部接口（柜台端）

| 功能 | 前端方法 | 后端接口 |
|------|---------|---------|
| 员工登录 | `adminLogin()` | `POST /api/internal/staff/login` |
| 证券开户 | `createSecuritiesAccount()` | `POST /api/internal/security/accounts` |
| 资金开户 | `createFundAccount()` | `POST /api/internal/fund/accounts` |
| 存款 | `deposit()` | `POST /api/internal/fund/deposit` |
| 取款 | `withdraw()` | `POST /api/internal/fund/withdraw` |
| 挂失/补办/销户 | 对应方法 | 对应接口 |

#### 7.2.3 黑名单检查（六号接口）

开户时前端会调用黑名单服务进行校验：

```typescript
// 资金账户开户时检查
const isBlacklisted = await api.checkBlacklist(userName);
if (isBlacklisted) {
  // 拦截开户，提示用户已在黑名单
}
```

- **接口**: `GET /api/trade-management/blacklist/check?userName={userName}`
- **用途**: 证券开户、资金开户前检查用户是否在黑名单中
- **前端位置**: `FundAccounts.tsx` 和 `SecuritiesAccounts.tsx`

### 7.2.4 Dashboard 统计接口（新增）

| 功能 | 前端方法 | 后端接口 |
|------|---------|---------|
| 统计数据 | `getDashboardStats()` | `GET /api/internal/dashboard/stats` |
| 最近日志 | `getRecentLogs()` | `GET /api/internal/dashboard/recent-logs` |

返回数据：
- `security_account_count`: 证券账户总数
- `fund_account_count`: 资金账户总数
- `today_new_accounts`: 今日新开账户数
- `abnormal_account_count`: 异常账户数（冻结状态）

### 7.2.5 账户列表查询接口（新增）

| 功能 | 前端方法 | 后端接口 |
|------|---------|---------|
| 证券账户列表 | `listSecurityAccounts()` | `GET /api/internal/security/accounts` |
| 资金账户列表 | `listFundAccounts()` | `GET /api/internal/fund/accounts/list` |


### 7.3 认证机制

#### 投资者端（auth_token）
1. 登录成功后，后端返回 `auth_token`
2. 前端保存到 `localStorage`
3. 后续请求通过 URL 参数传递 `auth_token`

#### 柜台端（X-Staff-Auth-Token）
1. 登录成功后，后端返回 `staff_auth_token`
2. 前端保存到 `localStorage`
3. 后续请求通过 HTTP Header `staff_auth_token` 传递

### 7.4 安全退出功能

管理端和用户端均实现了安全退出功能：

- **管理端**: 点击侧边栏"退出登录"按钮
- **用户端**: 点击侧边栏"安全退出"按钮

退出操作会：
1. 清除 `localStorage` 中的 token（`api.clearToken()`）
2. 跳转到登录页面（`/login`）


## 8. 使用方法

### 8.1 启动后端服务

```bash
# 1. 确保MySQL已启动，并创建数据库

# 2. 执行数据库脚本
mysql -u your_username -p account_db < scripts/01_create_tables.sql
mysql -u your_username -p account_db < scripts/02_views.sql
mysql -u your_username -p account_db < scripts/03_test_data.sql

# 3. 配置数据库连接
# 编辑 src/main/resources/application.yml
# 或设置环境变量 ACCOUNT_DB_USERNAME 和 ACCOUNT_DB_PASSWORD

# 4. 启动Spring Boot应用
mvn spring-boot:run
# 或使用IDEA运行 AccountManagementApplication
```

后端服务默认监听 `http://localhost:8080`

### 8.2 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器默认监听 `http://localhost:5173`

### 8.3 启动黑名单服务

确保交易管理系统的黑名单服务已启动，默认监听 `http://localhost:8081`

### 8.4 访问系统

#### 投资者端（账户查询端）
- 地址: `http://localhost:5173/login`
- 测试账户: 使用数据库中预置的资金账户和密码登录

#### 柜台端（管理员后台）
- 地址: `http://localhost:5173/login`
- 切换至"管理端"标签
- 测试员工: 使用数据库中预置的员工账号和密码登录

### 8.5 完整启动流程示例

```bash
# 终端1：启动MySQL（如果未启动）
# ...

# 终端2：启动Java后端
cd accout_management
mvn spring-boot:run

# 终端3：启动黑名单服务（交易管理系统）
# cd trade-management
# ./start.sh 或对应启动命令

# 终端4：启动前端
cd accout_management/frontend
npm install
npm run dev

# 访问 http://localhost:5173
```

### 8.6 注意事项

1. **跨域问题**: 后端已配置CORS，允许前端跨域访问
2. **端口冲突**: 确保8080（后端）、5173（前端）、8081（黑名单服务）端口未被占用
3. **数据库连接**: 确保MySQL连接信息正确配置
4. **黑名单服务**: 开户功能依赖黑名单服务，需确保该服务已启动
