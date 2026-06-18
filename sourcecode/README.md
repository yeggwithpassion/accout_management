# 账户业务 DAO 模块

本模块位于 `soft_attack/sourcecode`，对应 `soft_attack/README.md` 中分配给 `崔大元` 的工作内容：账户业务子系统后端 `DAO` 层实现。

## 模块范围

- 基于 `JDBC` 实现设计报告中相关数据表的增查改操作
- 提供可复用的事务控制、SQL 执行与结果映射工具
- 提供投资者、证券账户、资金账户、持仓、资金流水、操作日志、工作人员等 `DAO` 类
- 提供对外黑名单接口的账户侧桥接能力，可按姓名、证券账户号、资金账户号做黑名单校验
- 统一使用 `PreparedStatement`，避免直接拼接 SQL 带来的注入风险

## 目录结构

- `account.dao.core`：连接管理、事务管理、JDBC 通用工具
- `account.dao.model`：领域枚举与数据模型
- `account.dao`：具体 `DAO` 实现与 `DaoRegistry` 统一入口
- `account.blacklist`：外部黑名单接口客户端与账户桥接支持

## 与设计报告的对应关系

当前实现已对齐设计报告中明确给出或反复引用的以下核心表：

- `investor`
- `security_account`
- `fund_account`
- `fund_transaction_log`
- `holding`
- `staff`
- `operation_log`

## 关于 `blacklist` 的边界

设计报告中多次提到了 `blacklist`，但当前项目数据库不维护本地 `blacklist` 表：

- `blacklist`：通过外部黑名单接口完成校验，不属于当前 DAO 模块的本地数据库对象

如果后续确实要把黑名单做成本地表，再单独补充 `BlacklistDao` 和对应脚本即可。

## 黑名单接口使用示例

```java
var registry = DaoRegistry.forDriverManager(
        "jdbc:mysql://localhost:3306/stock_account",
        "root",
        "password"
);

var blacklistClient = HttpBlacklistClient.forBaseUrl("http://localhost:8081");
var blacklistSupport = registry.blacklistSupport(blacklistClient);

boolean blockedByName = blacklistSupport.isBlockedByUserName("张三");
boolean blockedByFundAccount = blacklistSupport.isBlockedByFundAccountNo("FA2026000001");
```

当上层只有 `fundAccountNo` 或 `secAccNo` 时，模块会先通过本地账户表查出投资者姓名，再调用 `docs/BLACKLIST_API.md` 约定的黑名单查询接口。

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