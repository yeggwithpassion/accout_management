# 账户业务子系统后端

本仓库是证券账户与资金账户子系统的后端实现，当前只维护 `src/` 这一套代码。

当前统一约定如下：

- 接口统一使用 `/api/...`，不再保留 `/api/v1/...`
- 不维护本地 `blacklist` 表，黑名单通过外部桥接校验
- 不维护本地 `freeze_record` 表
- 不做 RBAC / permission 体系
- 业务顺序为先开证券账户，再开资金账户；资金账户创建后自动绑定证券账户
- 投资者侧通过本系统签发 `auth_token`
- 工作人员侧通过本系统签发 `X-Staff-Auth-Token`
- 交易回调采用“交易号 + 动作类型 + 金额/数量”的模型，本系统自己落资金流水和持仓变动日志

## 1. 代码结构

### 1.1 顶层目录

- `src/`：主代码与测试代码
- `scripts/`：数据库建表、视图、测试数据脚本
- `docs/`：补充设计文档、接口文档、实验大纲等
- `pom.xml`：Maven 构建配置

### 1.2 Java 包结构

`src/main/java/account/` 下主要目录如下：

- `common/`：通用返回体、错误码、业务异常、请求头常量
- `config/`：Spring 配置
- `controller/`：HTTP 接口入口
- `dao/`：数据库访问层
- `dto/`：请求/响应 DTO
- `enums/`：对外枚举定义
- `exception/`：全局异常处理
- `integration/`：外部桥接组件，例如黑名单桥接
- `service/`：核心业务实现
- `AccountManagementApplication.java`：Spring Boot 启动类

### 1.3 Controller 分层

`src/main/java/account/controller/internal/`

- `StaffController`：工作人员登录、停用离职工作人员
- `FundAccountController`：内部资金账户接口
- `SecurityAccountController`：内部证券账户接口、投资者信息修改

`src/main/java/account/controller/external/`

- `ExternalFundController`：投资者资金查询、登录、改密
- `ExternalSecurityController`：投资者持仓查询
- `ExternalTradeController`：中央交易系统回调接口
- `AdminController`：冻结、解冻、强制销户、结息
- `AuditController`：操作日志审计查询

### 1.4 Service 分工

- `SecurityAccountServiceImpl`：证券开户、挂失、补办、销户、投资者信息修改、持仓查询、持仓回调
- `FundAccountServiceImpl`：资金开户、存取款、改密、挂失、补办、销户、绑定解绑、资金查询、资金回调
- `AdminServiceImpl`：管理员冻结、解冻、强制销户、年度结息
- `AuditServiceImpl`：操作日志查询
- `StaffServiceImpl`：工作人员登录、工作人员停用
- `ClientAuthTokenService`：投资者 token 签发与校验
- `StaffAuthTokenService`：工作人员 token 签发与校验

### 1.5 其他关键目录

- `src/main/resources/application.yml`：数据库与 Spring 配置
- `src/test/java/account/`：单元测试与集成测试
- `docs/API.md`：补充接口说明
- `docs/代码结构说明.md`：更细粒度的代码结构说明

## 2. 数据库字段、数据类型与关系

初始化脚本：

- `scripts/01_create_tables.sql`
- `scripts/02_views.sql`
- `scripts/03_test_data.sql`
- `scripts/04_optional_procedures.sql`

### 2.1 关系总览

```text
investor 1 --- n security_account
security_account 1 --- 1 fund_account
security_account 1 --- n holding
security_account 1 --- n holding_change_log
fund_account 1 --- n fund_transaction_log
staff 1 --- n operation_log
staff 1 --- n fund_transaction_log

security_account.linked_fund_acc -> fund_account.fund_acc_no
fund_account.sec_acc_no          -> security_account.sec_acc_no
```

### 2.2 表结构

#### `investor`

投资者主数据表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `investor_id` | `INT` | PK, AUTO_INCREMENT | 投资者主键 |
| `type` | `ENUM('个人','法人')` | NOT NULL | 投资者类型 |
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

#### `staff`

工作人员账号表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `staff_id` | `INT` | PK, AUTO_INCREMENT | 工作人员主键 |
| `username` | `VARCHAR(50)` | NOT NULL, UNIQUE | 登录名 |
| `password_hash` | `VARCHAR(128)` | NOT NULL | 密码哈希 |
| `status` | `ENUM('正常','禁用')` | NOT NULL | 账号状态 |
| `created_at` | `DATETIME` | NOT NULL | 创建时间 |

说明：

- 工作人员离职采用逻辑停用，不做物理删除
- 原因是 `operation_log` 与 `fund_transaction_log` 需要保留审计引用

#### `security_account`

证券账户主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `sec_acc_no` | `VARCHAR(20)` | PK | 证券账户号 |
| `investor_id` | `INT` | NOT NULL, FK | 所属投资者 |
| `status` | `ENUM('正常','挂失冻结','违规冻结','无资金账户冻结','预销户','已销户')` | NOT NULL | 账户状态 |
| `open_date` | `DATE` | NOT NULL | 开户日期 |
| `linked_fund_acc` | `VARCHAR(20)` | NULL, UNIQUE, FK | 绑定资金账户号 |

#### `fund_account`

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
| `status` | `ENUM('正常','挂失冻结','违规冻结','已销户')` | NOT NULL | 账户状态 |
| `open_date` | `DATE` | NOT NULL | 开户日期 |
| `last_interest_date` | `DATE` | NULL | 上次结息日期 |
| `annual_interest_rate` | `DECIMAL(5,4)` | NOT NULL | 年利率 |

#### `fund_transaction_log`

资金流水表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `log_id` | `BIGINT` | PK, AUTO_INCREMENT | 流水主键 |
| `fund_acc_no` | `VARCHAR(20)` | NOT NULL, FK | 资金账户号 |
| `txn_type` | `ENUM('存款','取款','买入冻结','买入扣款','卖出回款','撤单解冻','结息')` | NOT NULL | 资金变动类型 |
| `amount` | `DECIMAL(15,2)` | NOT NULL | 本次变动金额 |
| `available_after` | `DECIMAL(15,2)` | NOT NULL | 变动后可用余额 |
| `frozen_after` | `DECIMAL(15,2)` | NOT NULL | 变动后冻结余额 |
| `ref_order_id` | `VARCHAR(50)` | NULL | 关联交易号 |
| `operator_id` | `INT` | NULL, FK | 柜台操作工作人员 |
| `txn_time` | `DATETIME` | NOT NULL | 流水时间 |

说明：

- 柜台业务如存款、取款、结息通常由系统或工作人员写入
- 交易相关流水由外部交易系统调用 `updateFundBalance` 触发写入
- 与持仓变化的关联键是 `ref_order_id`

#### `holding`

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

#### `holding_change_log`

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

说明：

- 由 `updateSecurityHolding` 写入
- 通过 `ref_order_id` 可与 `fund_transaction_log` 做业务关联

#### `operation_log`

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

`scripts/02_views.sql` 当前定义了 3 个视图：

- `v_fund_account_simple`：资金账户基础视图
- `v_holding_available`：持仓可用数量视图
- `v_investor_basic`：投资者基础信息视图

### 2.4 当前明确不保留的表

- `blacklist`
- `freeze_record`
- `permission`
- 其他 RBAC 相关表

## 3. 外部接口

外部接口主要分两类：

- 投资者客户端接口
- 中央交易系统回调接口

统一返回格式：

```json
{
  "code": 0,
  "message": "成功"
}
```

成功时会在同层追加业务字段；失败时通过 `code` 和 `message` 表示错误。

### 3.1 投资者认证

投资者先调用登录接口，由本系统签发 `auth_token`。后续资金查询、持仓查询、投资者自助改密都使用这个 token。

### 3.2 接口总表

| 接口名 | 方法 | 路径 | 鉴权 | 请求参数 | 主要响应字段 |
|---|---|---|---|---|---|
| `clientLoginAuth` | `POST` | `/api/external/fund/login` | 无 | `fund_acc_no`, `trade_password` | `auth_token`, `fund_acc_no`, `sec_acc_no`, `status` |
| `getFundSnapshot` | `GET` | `/api/external/fund/snapshot` | `auth_token` | `fund_acc_no`, `auth_token` | `available_balance`, `frozen_balance`, `currency`, `status`, `recent_logs` |
| `clientChangeFundPassword` | `PUT` | `/api/external/fund/password` | `auth_token` | `fund_acc_no`, `auth_token`, `password_type`, `old_password`, `new_password` | `code`, `message` |
| `getSecuritySnapshot` | `GET` | `/api/external/security/snapshot` | `auth_token` | `sec_acc_no`, `auth_token`, `stock_code` 可选 | `sec_acc_no` 以及单只或全持仓数据 |
| `updateFundBalance` | `POST` | `/api/external/trade/fund-balance` | 当前未做独立系统签名 | `fund_acc_no`, `ref_order_id`, `txn_type`, `amount` | `available_balance`, `frozen_balance`, `log_id`, `duplicate` |
| `updateSecurityHolding` | `POST` | `/api/external/trade/security-holding` | 当前未做独立系统签名 | `sec_acc_no`, `stock_code`, `stock_name`, `ref_order_id`, `change_type`, `quantity`, `price` | `log_id`, `duplicate`, `quantity`, `frozen_quantity`, `available_quantity`, `avg_cost` |

### 3.3 外部接口详细语义

#### `POST /api/external/fund/login`

请求体：

```json
{
  "fund_acc_no": "FA2026000001",
  "trade_password": "123456"
}
```

响应关键字段：

- `auth_token`
- `fund_acc_no`
- `sec_acc_no`
- `status`

#### `GET /api/external/fund/snapshot`

请求参数：

- `fund_acc_no`
- `auth_token`

响应关键字段：

- `available_balance`
- `frozen_balance`
- `currency`
- `status`
- `recent_logs`

`recent_logs` 中每条记录字段可能包含：

- `log_id`
- `txn_type`
- `amount`
- `txn_time`
- `ref_order_id`
- `stock_code`
- `stock_name`
- `holding_change_type`
- `share_quantity`
- `price`
- `holding_quantity_after`
- `holding_frozen_quantity_after`

#### `PUT /api/external/fund/password`

请求体：

```json
{
  "fund_acc_no": "FA2026000001",
  "auth_token": "token",
  "password_type": "trade",
  "old_password": "123456",
  "new_password": "654321"
}
```

`password_type` 允许值：

- `trade`
- `withdraw`

#### `GET /api/external/security/snapshot`

请求参数：

- `sec_acc_no`
- `auth_token`
- `stock_code` 可选

当传 `stock_code` 时，返回单只证券持仓：

- `sec_acc_no`
- `stock_code`
- `stock_name`
- `quantity`
- `frozen_quantity`
- `available_quantity`
- `avg_cost`

当不传 `stock_code` 时，返回：

- `sec_acc_no`
- `holdings`

其中 `holdings` 中每项包含：

- `stock_code`
- `stock_name`
- `quantity`
- `frozen_quantity`
- `available_quantity`
- `avg_cost`

#### `POST /api/external/trade/fund-balance`

接口语义：交易系统告诉账户系统“哪个账户、哪笔订单、什么资金动作、金额多少”，账户系统自己更新余额并写流水。

请求体：

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

系统行为：

- 更新 `fund_account.available_balance`
- 更新 `fund_account.frozen_balance`
- 写入 `fund_transaction_log`
- 使用 `ref_order_id + txn_type` 做幂等控制

#### `POST /api/external/trade/security-holding`

接口语义：交易系统告诉账户系统“哪个证券账户、哪只股票、哪笔订单、什么持仓动作、股数和价格”，账户系统自己更新当前持仓并写持仓变动日志。

请求体：

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

系统行为：

- 更新 `holding`
- 写入 `holding_change_log`
- 使用 `ref_order_id + change_type + sec_acc_no + stock_code` 做幂等控制

### 3.4 外部接口与交易日志关联

资金流水和持仓变化通过 `ref_order_id` 关联。

也就是说，同一笔交易通常会留下两侧事实：

- `fund_transaction_log.ref_order_id = ORD-...`
- `holding_change_log.ref_order_id = ORD-...`

查询资金流水时，系统会尝试把同一 `ref_order_id` 对应的持仓变化附带返回，方便对账。

## 4. 内部接口

内部接口分为三类：

- 工作人员登录
- 柜台业务接口
- 管理员 / 审计接口

### 4.1 鉴权

工作人员先调用：

- `POST /api/internal/staff/login`

成功后拿到 `auth_token`，后续内部和管理员接口统一在请求头带：

```http
X-Staff-Auth-Token: <token>
```

注意：

- 请求体里的 `staff_id`、`admin_id`、`operator_id` 只是服务端回填使用
- 服务端真实身份来自 `X-Staff-Auth-Token`

### 4.2 内部接口总表

| 接口名 | 方法 | 路径 | 鉴权 | 请求参数 | 主要响应字段 |
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
| `queryFundInfo` | `GET` | `/api/internal/fund/accounts` | `X-Staff-Auth-Token` | `fund_acc_no`, `id_number`, `include_logs` 可选 | `fund_acc_no`, `available_balance`, `frozen_balance`, `currency`, `status`, `logs` |
| `createSecurityAccount` | `POST` | `/api/internal/security/accounts` | `X-Staff-Auth-Token` | `investor_type`, `name`, `gender`, `id_type`, `id_number`, `phone`, `address`, `work_unit`, `occupation`, `education` 及法人代理字段 | `sec_acc_no`, `status`, `investor_id` |
| `updateInvestorInfo` | `PUT` | `/api/internal/security/investors` | `X-Staff-Auth-Token` | `investor_id`, 可选修改字段如 `name`, `gender`, `id_type`, `id_number`, `phone`, `address`, `work_unit`, `occupation`, `education` 等 | 投资者更新后的信息字段 |
| `reportSecurityLoss` | `POST` | `/api/internal/security/accounts/loss` | `X-Staff-Auth-Token` | `sec_acc_no`, `id_number`, `reason` | `status` |
| `reissueSecurityAccount` | `POST` | `/api/internal/security/accounts/reissue` | `X-Staff-Auth-Token` | `old_sec_acc_no`, `id_number` | `new_sec_acc_no`, `old_sec_acc_no` |
| `closeSecurityAccount` | `POST` | `/api/internal/security/accounts/close` | `X-Staff-Auth-Token` | `sec_acc_no`, `id_number`, `reason` | `status` |
| `settleAnnualInterest` | `POST` | `/api/admin/fund/settle-annual-interest` | `X-Staff-Auth-Token` | `year_rate` 可选 | `total_accounts`, `total_interest` |
| `adminFreezeAccount` | `POST` | `/api/admin/accounts/freeze` | `X-Staff-Auth-Token` | `account_type`, `account_no`, `freeze_type`, `reason` | `code`, `message` |
| `adminUnfreezeAccount` | `POST` | `/api/admin/accounts/unfreeze` | `X-Staff-Auth-Token` | `account_type`, `account_no`, `freeze_type` | `code`, `message` |
| `adminGetAccountDetails` | `GET` | `/api/admin/accounts/{account_no}` | `X-Staff-Auth-Token` | 路径参数 `account_no` | 账户详情字段 |
| `adminCloseSecurityAccount` | `POST` | `/api/admin/security/force-close` | `X-Staff-Auth-Token` | `security_account_no`, `force_reason` | `code`, `message` |
| `queryOperationLog` | `GET` | `/api/admin/audit/operation-logs` | `X-Staff-Auth-Token` | `staff_id` 可选, `time_from`, `time_to`, `operation_type` 可选, `target_type` 可选, `target_id` 可选 | `logs`, `total` |

### 4.3 内部接口关键语义

#### 工作人员登录

`POST /api/internal/staff/login`

请求体：

```json
{
  "username": "staff01",
  "password": "staff01pass"
}
```

响应关键字段：

- `staff_id`
- `username`
- `status`
- `auth_token`

#### 工作人员停用

`POST /api/internal/staff/deactivate`

请求体：

```json
{
  "target_staff_id": 2,
  "reason": "离职"
}
```

语义说明：

- 这是逻辑停用，不是物理删除
- 停用后该工作人员状态改为 `禁用`
- 该工作人员已有登录 token 会立即失效
- 会写入 `operation_log`

#### 投资者信息修改

`PUT /api/internal/security/investors`

请求体示例：

```json
{
  "investor_id": 1,
  "name": "张三",
  "phone": "13800000000",
  "address": "杭州",
  "work_unit": "ZJU"
}
```

语义说明：

- 允许修改投资者基础资料
- 如果修改 `id_type` / `id_number`，会重新做证件合法性与唯一性校验
- 对个人投资者，仍然按当前身份证号实时判断是否成年
- 系统不单独维护“是否成年”字段
- 会写入 `operation_log`

#### 证券开户

`POST /api/internal/security/accounts`

当前实现重点如下：

- 只正式支持个人开户
- 未成年人禁止开户
- 证件校验当前按 18 位身份证处理
- 黑名单通过外部桥接校验
- 会创建 `investor` 与 `security_account`
- 会写 `operation_log`

#### 资金开户

`POST /api/internal/fund/accounts`

当前实现重点如下：

- 必须基于已存在证券账户开户
- 身份证号必须与证券账户持有人一致
- 资金账户创建后自动与证券账户绑定
- 若证券账户之前因“无资金账户”被冻结，绑定后自动恢复正常
- 会写 `operation_log`

#### 存取款

- `POST /api/internal/fund/deposit`
- `POST /api/internal/fund/withdraw`

两者都会：

- 修改 `fund_account`
- 写 `fund_transaction_log`
- 写 `operation_log`

#### 挂失与补办

证券账户和资金账户都支持挂失、补办。

其中资金账户挂失会联动冻结关联证券账户；补办后会重新绑定新资金账户并失效旧投资者 token。

#### 销户与解绑

当前主要规则：

- 证券账户销户前必须无持仓
- 资金账户销户前必须无可用余额、无冻结余额
- 资金账户解绑或销户后，证券账户会进入“无资金账户冻结”状态
- 重新绑定资金账户后，证券账户可恢复正常

#### 管理员接口

管理员接口复用工作人员身份体系，不单独建管理员账户表。

`account_type` 允许值：

- `SECURITY`
- `FUND`

`freeze_type` 允许值：

- `LOSS`
- `VIOLATION`

语义说明：

- `LOSS` 冻结不能通过管理员接口直接解冻，必须走挂失补办流程
- `VIOLATION` 冻结可以通过管理员接口解冻

#### 审计接口

`GET /api/admin/audit/operation-logs`

支持按以下维度过滤：

- `staff_id`
- `time_from`
- `time_to`
- `operation_type`
- `target_type`
- `target_id`

返回字段：

- `logs`
- `total`

其中 `logs` 中每项字段包括：

- `log_id`
- `staff_id`
- `operation_type`
- `target_type`
- `target_id`
- `detail`
- `operation_time`

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
| `1006` | `ERR_006` | 该投资者已拥有其他证券账户 |
| `1007` | `ERR_007` | 资金账户尚有可用余额或冻结资金，当前操作不允许 |
| `1008` | `ERR_008` | 证券账户未关联当前资金账户 |
| `1009` | `ERR_009` | 工作人员认证失败 |
| `1010` | `ERR_010` | 账户不存在 |
| `1011` | `ERR_011` | 账户已是请求的状态 |
| `1012` | `ERR_012` | 投资者在黑名单中 |
| `1013` | `ERR_013` | 证券账户持有人与投资者身份证不一致 |
| `1014` | `ERR_014` | 账户绑定关系冲突 |
| `1015` | `ERR_015` | 资金账户未绑定符合要求的证券账户 |
| `1016` | `ERR_016` | 资金账户存在未成交委托单 |
| `1017` | `ERR_017` | 资金账户处于冻结状态，当前操作不允许 |
| `1018` | `ERR_018` | 认证令牌无效或已失效 |
| `1019` | `ERR_019` | 开户资格不符合 |
| `1020` | `ERR_020` | 证件类型或证件号码不合法 |
| `1021` | `ERR_021` | 当前账户状态不允许执行该操作 |
| `1022` | `ERR_022` | 证券账户仍有持仓，无法销户 |
| `4000` | `ERR_PARAM` | 参数校验失败 |
| `5000` | `ERR_SYS` | 系统内部错误 |

### 5.2 使用说明

主要分工如下：

- `ERR_001`：资金不足、冻结资金不足
- `ERR_002`：可卖持仓不足、冻结持仓不足
- `ERR_003`：账户被冻结，禁止继续操作
- `ERR_004`：交易密码或取款密码错误
- `ERR_005` / `ERR_010`：账户不存在
- `ERR_012`：黑名单桥接校验失败
- `ERR_014` / `ERR_015`：绑定关系不满足
- `ERR_018`：投资者或工作人员 token 失效
- `ERR_019`：开户资格不满足，例如未成年人
- `ERR_020`：身份证件类型或号码不合法
- `ERR_021`：账户状态冲突，例如已销户、非挂失状态下补办、管理员解冻场景不匹配
- `ERR_022`：证券账户仍有持仓，不能销户

### 5.3 当前遗留点

- `ERR_008` 当前基本未实际使用
- `ERR_016` 当前基本未实际使用，因为本系统未单独维护“未成交委托单”表
- `ERR_013` 仍同时覆盖“投资者不存在”和“持有人身份不匹配”两类场景

## 6. 运行与校验

常用命令：

```bash
mvn test
```

当前状态：

- `sourcecode/` 已移除
- 外部接口与内部接口已分开
- 工作人员鉴权已接入
- 投资者鉴权已接入
- 资金流水与持仓变动日志已通过 `ref_order_id` 关联
