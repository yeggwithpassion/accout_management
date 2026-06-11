# 账户业务 DAO 模块

本模块位于 `soft_attack/sourcecode`，对应 `soft_attack/README.md` 中分配给 `崔大元` 的工作内容：账户业务子系统后端 `DAO` 层实现。

## 模块范围

- 基于 `JDBC` 实现设计报告中相关数据表的增查改操作
- 提供可复用的事务控制、SQL 执行与结果映射工具
- 提供投资者、证券账户、资金账户、持仓、资金流水、操作日志、工作人员、冻结记录、黑名单等 `DAO` 类
- 统一使用 `PreparedStatement`，避免直接拼接 SQL 带来的注入风险

## 目录结构

- `account.dao.core`：连接管理、事务管理、JDBC 通用工具
- `account.dao.model`：领域枚举与数据模型
- `account.dao`：具体 `DAO` 实现与 `DaoRegistry` 统一入口

## 与设计报告的对应关系

当前实现已对齐设计报告中明确给出或反复引用的以下核心表：

- `investor`
- `security_account`
- `fund_account`
- `fund_transaction_log`
- `holding`
- `staff`
- `operation_log`

## 关于 `freeze_record` 和 `blacklist`

设计报告中多次提到了 `freeze_record` 和 `blacklist`，但没有像其他表一样给出完整的物理字段表。因此本模块在代码中对这两张表采用了明确、可调整的默认字段假设：

- `freeze_record`：`record_id`、`account_type`、`account_no`、`freeze_type`、`reason`、`frozen_amount`、`frozen_quantity`、`operator_id`、`created_at`、`released_at`、`active`
- `blacklist`：`blacklist_id`、`certificate_no`、`reason`、`created_by`、`active`、`created_at`、`updated_at`

如果后续数据库组给出的最终建表字段名与这里不同，只需要小范围调整：

- `FreezeRecordDao`
- `BlacklistDao`

## 使用示例

```java
var registry = DaoRegistry.forDriverManager(
        "jdbc:mysql://localhost:3306/stock_account",
        "root",
        "password"
);

registry.transactionManager().execute(connection -> {
    var account = registry.fundAccountDao().findByAccountNoForUpdate(connection, "FA10001")
            .orElseThrow();

    registry.fundAccountDao().updateBalances(
            connection,
            account.fundAccNo(),
            account.availableBalance().subtract(new java.math.BigDecimal("100.00")),
            account.frozenBalance().add(new java.math.BigDecimal("100.00"))
    );
    return null;
});
```

## 构建方式

```bash
mvn -q -DskipTests package
```

## 说明

本模块本身没有额外的编译期第三方依赖。最终接入具体服务时，只需要在运行环境中提供对应数据库的 `JDBC Driver`，例如 `MySQL Connector/J`。
