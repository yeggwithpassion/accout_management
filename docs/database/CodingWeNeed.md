好的，既然你们只负责数据库部分，需要交付的代码主要包括：

1. **SQL 建表脚本（DDL）** – 创建所有表、主键、外键、索引、默认值、注释。
2. **存储过程脚本** – 封装核心业务逻辑（存款、取款、资金冻结/扣款/解冻、持仓变更、年结息等），保证事务和幂等。
3. **视图脚本** – 简化常用查询（如资金账户简明信息、持仓可用数量）。
4. **测试数据脚本** – 插入示例数据，供前后端联调。
5. **使用文档** – 说明每个存储过程的调用方式、参数、返回结果及错误码。

下面是一个具体的代码编写清单和示例。

---

## 1. 建表脚本（DDL）

文件：`01_create_tables.sql`

包含以下表的 `CREATE TABLE` 语句：
- `investor`
- `security_account`
- `fund_account`
- `fund_transaction_log`
- `staff`
- `holding`
- `operation_log`

同时添加必要的索引（例如 `fund_account.sec_acc_no` 唯一索引，`fund_transaction_log.ref_order_id` 索引用于幂等查询等）。

---

## 2. 存储过程脚本

文件：`02_stored_procedures.sql`

需要编写的存储过程（按优先级排序）：

| 优先级 | 存储过程名 | 功能 |
|--------|------------|------|
| **高** | `sp_deposit` | 存款（更新可用余额 + 插入流水） |
| **高** | `sp_withdraw` | 取款（校验密码+余额，扣减余额+插入流水） |
| **高** | `sp_freeze_fund_for_order` | 买入委托冻结资金（可用→冻结，插入冻结流水） |
| **高** | `sp_confirm_buy` | 买入成交（扣减冻结余额，过户股票，更新持仓） |
| **高** | `sp_confirm_sell` | 卖出成交（增加可用余额，扣减持仓，插入回款流水） |
| **高** | `sp_unfreeze_fund` | 撤单解冻资金（冻结→可用，插入解冻流水） |
| **中** | `sp_create_security_account` | 证券账户开户（校验黑名单、重复，生成账号，插入记录） |
| **中** | `sp_create_fund_account` | 资金账户开户（校验证券账户，绑定，插入记录） |
| **中** | `sp_change_fund_password` | 修改资金账户密码 |
| **中** | `sp_lock_security_account` | 挂失证券账户（更新状态+冻结持仓） |
| **低** | `sp_annual_interest` | 年结息（批量更新余额+插入结息流水） |
| **低** | `sp_staff_login` | 工作人员登录校验 |

每个存储过程内部使用 `START TRANSACTION` … `COMMIT` / `ROLLBACK`，并返回统一格式的 `code` 和 `message`（通过 `OUT` 参数或 `SELECT`）。建议使用 `OUT` 参数返回结果，例如：

```sql
CREATE PROCEDURE sp_deposit(
    IN p_fund_acc_no VARCHAR(20),
    IN p_amount DECIMAL(15,2),
    IN p_operator_id INT,
    OUT p_code INT,
    OUT p_message VARCHAR(128)
)
```

约定 `p_code = 0` 表示成功，非 0 表示错误码（可参考设计报告中的错误码定义）。

---

## 3. 视图脚本

文件：`03_views.sql`

建议创建的视图：

- `v_fund_account_simple` – 资金账户基本信息（不含密码），用于快速查询余额。
- `v_holding_available` – 持仓 + 可卖数量字段。
- `v_investor_basic` – 投资者简要信息（不含扩展字段）。
- `v_recent_transactions` – 最近7天的资金流水（便于后端展示）。

---

## 4. 测试数据脚本

文件：`04_test_data.sql`

插入示例数据：
- 2~3 个投资者（个人、法人各一个）
- 对应的证券账户、资金账户
- 1 个工作人员（用户名 `admin`, 密码哈希需预计算）
- 少量持仓记录
- 少量资金流水

---

## 5. 使用文档

文件：`README.md` 或 `数据库接口文档.md`

内容包括：
- 数据库连接信息（主机、端口、数据库名、账号权限建议）
- 表结构说明（可选，引用 DDL 中的注释）
- 每个存储过程的详细说明：
  - 功能描述
  - 输入参数表
  - 输出参数（code, message）
  - 错误码列表（对应设计报告 3.7.6）
  - 调用示例（SQL 调用，以及 Java JDBC 调用示例）
- 视图的用途和字段说明
- 注意事项（事务、幂等、密码加密方式等）

---

## 总结

作为数据库小组，你需要交付的**代码文件**至少包括：

```
db_scripts/
├── 01_create_tables.sql
├── 02_stored_procedures.sql
├── 03_views.sql
├── 04_test_data.sql
└── README.md
```

其中，`02_stored_procedures.sql` 是核心，建议优先实现高优先级的 6 个存储过程。如果时间紧张，可以先实现 `sp_deposit`, `sp_withdraw`, `sp_freeze_fund_for_order`, `sp_confirm_buy`, `sp_confirm_sell`，其他存储过程可提供空壳或后续补充。

是否需要我帮你生成这些脚本的**具体代码**？如果需要，请告诉我优先写哪些存储过程。