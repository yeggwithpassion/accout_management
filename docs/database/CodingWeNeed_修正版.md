# 数据库代码交付清单（修正版）

## 1. 说明

本文用于明确：在当前版本范围内，数据库小组**具体需要写哪些代码文件**。

本清单以当前已确认的数据库设计和接口边界为准，约束如下：

- 不维护 `blacklist` 表
- 不维护 `freeze_record` 表
- 不做 RBAC 角色体系
- 不单独记录 IP 地址
- 账户冻结判断以 `status` 为主
- 交易冻结只通过 `fund_account.frozen_balance` 和 `holding.frozen_quantity` 表达

因此，任何代码文件如果隐含依赖黑名单表、冻结记录表、角色体系或 IP 审计字段，都不属于当前版本必须实现的内容。

## 2. 先给结论

当前版本数据库小组建议交付的代码文件如下：

```text
db_scripts/
├── 01_create_tables.sql
├── 02_views.sql
├── 03_test_data.sql
├── 04_optional_procedures.sql
└── README.md
```

其中：

- `01_create_tables.sql`：必须
- `02_views.sql`：建议有
- `03_test_data.sql`：必须
- `04_optional_procedures.sql`：可选，不是必须
- `README.md`：必须

## 3. 为什么这样定

当前你们负责的是**数据库部分**，重点是把：

- 表结构定义清楚
- 约束、索引、默认值写清楚
- 联调数据准备好
- 查询辅助对象准备好
- 数据库使用说明写清楚

至于“是否必须把核心业务全部封装成存储过程”，当前版本并不是硬性要求。

原因是：

1. 你们当前系统边界比较清晰，很多业务逻辑完全可以由后端服务完成。
2. 如果强行把所有业务写进存储过程，工作量会明显上升，而且联调时不一定更方便。
3. 当前版本还不涉及黑名单、冻结记录、RBAC、IP 审计等复杂能力，没有必要把数据库层设计得过重。

所以更合理的做法是：

- **先把数据库结构和数据约束做好**
- **再按时间决定是否补少量关键存储过程**

## 4. 必需交付的文件

## 4.1 `01_create_tables.sql`

这是最核心的文件，必须完成。

### 应包含内容

- 建库语句（如果你们需要）
- 7 张核心表的 `CREATE TABLE`
- 主键
- 外键
- 唯一约束
- 必要索引
- 默认值
- 字段注释或表注释（如果你们打算写）

### 应创建的表

- `investor`
- `security_account`
- `fund_account`
- `fund_transaction_log`
- `staff`
- `holding`
- `operation_log`

### 建议加的索引

- `investor.id_number` 唯一索引
- `security_account.investor_id` 索引
- `security_account.linked_fund_acc` 唯一索引
- `fund_account.sec_acc_no` 唯一索引
- `fund_transaction_log.fund_acc_no` 索引
- `fund_transaction_log.ref_order_id` 索引
- `fund_transaction_log.txn_time` 索引
- `holding.sec_acc_no` 索引
- `holding(stock_code)` 索引
- `holding(sec_acc_no, stock_code)` 联合索引或唯一约束
- `operation_log.staff_id` 索引
- `operation_log.operation_time` 索引

### 这个文件里不要出现的内容

- `blacklist` 表
- `freeze_record` 表
- `role` 字段
- `ip_address` 字段

## 4.2 `02_views.sql`

这是建议交付文件，不是绝对必须，但很值得做。

### 建议创建的视图

#### `v_fund_account_simple`

用途：返回资金账户基础信息，不暴露密码字段。

建议字段：

- `fund_acc_no`
- `sec_acc_no`
- `available_balance`
- `frozen_balance`
- `currency`
- `status`

#### `v_holding_available`

用途：展示持仓及可卖数量。

建议字段：

- `holding_id`
- `sec_acc_no`
- `stock_code`
- `quantity`
- `frozen_quantity`
- `quantity - frozen_quantity AS available_quantity`
- `avg_cost`
- `updated_at`

#### `v_investor_basic`

用途：返回投资者基础信息，不带大段扩展字段。

建议字段：

- `investor_id`
- `type`
- `name`
- `id_type`
- `id_number`
- `phone`
- `address`

### 不建议写成视图的内容

- “最近7天流水”这种带相对时间条件的查询

原因：

- 这种逻辑更适合由查询 SQL 或后端参数控制
- 放进视图里不够通用

## 4.3 `03_test_data.sql`

这个文件建议作为必需交付。

### 用途

- 给前后端联调
- 给老师验收演示
- 给你们自己测试开户、绑定、存取款、持仓查询等流程

### 建议插入的数据

- 2 个个人投资者
- 1 个法人投资者
- 对应的证券账户
- 对应的资金账户
- 1 到 2 个工作人员
- 若干持仓记录
- 若干资金流水
- 若干操作日志

### 注意

- 工作人员用户名不要默认写成 `admin`
- 建议用：
  - `staff01`
  - `operator01`

### 密码字段要求

- `staff.password_hash`
- `fund_account.trade_password`
- `fund_account.withdraw_password`

都应该写入**预先计算好的哈希值**，不要写明文。

## 4.4 `README.md`

这个文件必须有。

### 应写的内容

- 本数据库包含哪些表
- 每张表是做什么的
- 当前版本明确不包含什么
- 如何执行建表脚本
- 如何执行测试数据脚本
- 视图是干什么的
- 如果有存储过程，如何调用
- 密码字段采用什么哈希方式
- 哪些表只允许插入、不允许更新或删除
- 关键事务应该覆盖哪些场景

### 建议单独说明的边界

- 不维护黑名单
- 不维护冻结记录表
- 不做角色体系
- 冻结先看账户状态，再看交易冻结字段

## 5. 可选交付的文件

## 5.1 `04_optional_procedures.sql`

这个文件是**可选项**，不是当前版本必须交付。

如果时间够，可以写少量真正有价值的存储过程；如果时间不够，可以不交，或者只交少数几个成熟过程。

### 推荐优先实现的存储过程

#### `sp_deposit`

功能：

- 校验资金账户状态
- 增加 `available_balance`
- 写入 `fund_transaction_log`

推荐原因：

- 逻辑清晰
- 事务短
- 很适合数据库层封装

#### `sp_withdraw`

功能：

- 校验状态
- 校验取款密码
- 校验余额
- 扣减 `available_balance`
- 写入资金流水

推荐原因：

- 是典型的原子资金操作

#### `sp_update_fund_balance`

功能：

- 处理买入冻结
- 处理买入扣款
- 处理卖出回款
- 处理撤单解冻

推荐原因：

- 交易系统对接时会比较集中
- 幂等逻辑可以围绕 `ref_order_id` 统一处理

#### `sp_update_security_holding`

功能：

- 买入增加持仓
- 卖出冻结持仓
- 卖出扣减持仓
- 撤单释放冻结持仓

推荐原因：

- 持仓变动规则适合集中收口

#### `sp_annual_interest`

功能：

- 计算结息
- 更新 `available_balance`
- 更新 `last_interest_date`
- 写入“结息”流水

推荐原因：

- 批量任务较适合数据库层统一执行

### 当前版本不建议优先写成存储过程的内容

- `staff_login`
- 证券账户开户
- 资金账户开户
- 黑名单校验
- 冻结记录维护

原因：

- 登录本质是普通查询
- 开户和补办涉及业务分支较多，应用层写更灵活
- 黑名单和冻结记录本来就不在当前范围内

## 6. 如果要写存储过程，建议的返回规范

如果你们决定写存储过程，建议统一：

- 输入参数：`IN`
- 输出结果：`OUT`
- 返回字段至少包括：
  - `code`
  - `message`

例如：

```sql
CREATE PROCEDURE sp_deposit(
    IN p_fund_acc_no VARCHAR(20),
    IN p_amount DECIMAL(15,2),
    IN p_operator_id INT,
    OUT p_code INT,
    OUT p_message VARCHAR(128)
)
```

约定：

- `code = 0` 表示成功
- 非 `0` 表示失败

如果过程内部有多表更新，应统一使用事务控制。

## 7. 不建议写进当前交付清单的内容

下面这些内容不应该继续写进“当前版本必须写的代码文件”里：

- 黑名单相关 SQL
- 冻结记录相关 SQL
- 角色权限表或角色权限初始化脚本
- IP 审计字段
- 空壳存储过程

特别是“空壳存储过程”不建议保留。

原因是：

- 它会让别人误以为功能已经完成
- 联调时容易产生错误预期

## 8. 推荐的最终交付口径

如果你们要对外说明“数据库小组到底交什么”，建议直接写成下面这样：

### 必需交付

- `01_create_tables.sql`
- `03_test_data.sql`
- `README.md`

### 建议交付

- `02_views.sql`

### 可选增强

- `04_optional_procedures.sql`

## 9. 一句话总结

当前版本数据库小组最应该交付的是：**可靠的表结构、正确的约束、可联调的测试数据、清楚的说明文档**；存储过程不是不能写，但应作为增强项，只做少量真正能提升一致性和事务性的核心过程，而不是把所有业务都强行堆到数据库层。
