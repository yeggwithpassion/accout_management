# 压力测试报告

- 生成时间：2026-06-21 19:08:11
- 测试对象：账户管理子系统后端接口（控制器级压力测试）
- 数据库环境：MySQL 8.0 (127.0.0.1:3306/account_db_pressure)
- 报告说明：章节组织参考根目录 PDF 模板中的压力测试部分，并补充了可复现过程文件。

## 1. 测试使用的技术栈

- Java 17
- JUnit 5
- Spring MockMvc
- MySQL 8.0 (127.0.0.1:3306/account_db_pressure)
- Maven Surefire
- PowerShell runner

## 2. 测试方法

- 基于现有集成测试栈构建控制器级压力测试，不额外引入 JMeter/Gatling 等外部工具。
- 使用固定并发度 + 固定任务数的方式压测四类场景：并发开户、重复资金回调、重复持仓回调、混合查询。
- 每个任务记录单次业务操作耗时，汇总平均值、P95、P99、吞吐量、成功/失败计数。
- 对幂等场景额外校验 duplicate 标记、最终余额/持仓、日志落库条数。

## 3. 测试样例

- 并发开户样例：30 组唯一成年自然人样例，每组执行 1 次证券开户 + 1 次资金开户链路。
- 重复资金回调样例：对同一资金账户重复回放 120 次同 ref_order_id 的买入冻结回调。
- 重复持仓回调样例：对同一证券账户重复回放 120 次同 ref_order_id 的买入增加回调。
- 混合查询样例：400 次读请求均匀分布到 Dashboard、Recent Logs、证券账户列表、资金账户列表、资金流水查询。

## 4. 测试结果

| 场景 | 并发度 | 任务数 | 成功 | 失败 | 平均耗时(ms) | P95(ms) | P99(ms) | 吞吐(op/s) | 校验结论 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 并发开户链路 | 10 | 30 | 30 | 0 | 71.97 | 131 | 131 | 136.99 | 通过 |
| 重复资金回调幂等 | 24 | 120 | 120 | 0 | 36.85 | 80 | 88 | 606.06 | 通过 |
| 重复持仓回调幂等 | 24 | 120 | 120 | 0 | 41.22 | 71 | 81 | 545.45 | 通过 |
| 混合并发查询 | 40 | 400 | 385 | 15 | 1020.33 | 3495 | 4409 | 37.38 | 未通过 |

### 并发开户链路

- 目标接口：POST /api/internal/security/accounts + POST /api/internal/fund/accounts
- 样例说明：30 组唯一成年个人样例，顺序执行证券开户后再执行资金开户
- 成功开户链路数: 30/30
- 按证件号回查到有效证券账户数: 30
- 失败任务数: 0

### 重复资金回调幂等

- 目标接口：POST /api/external/trade/fund-balance
- 样例说明：120 次相同 ref_order_id 的买入冻结回调
- duplicate=false 数量: 1
- duplicate=true 数量: 119
- 最终可用余额: 49900.00
- 最终冻结余额: 100.00
- 同 ref_order_id 资金流水条数: 1

### 重复持仓回调幂等

- 目标接口：POST /api/external/trade/security-holding
- 样例说明：120 次相同 ref_order_id 的买入增加回调
- duplicate=false 数量: 1
- duplicate=true 数量: 119
- 最终持仓数量: 10
- 最终冻结数量: 0
- 同 ref_order_id 持仓变更日志条数: 1

### 混合并发查询

- 目标接口：GET /api/internal/dashboard/* + GET /api/internal/security/accounts + GET /api/internal/fund/*
- 样例说明：400 次读请求，均匀分布到 5 类查询接口
- 混合查询成功数: 385/400
- 失败任务数: 15
- 被查询资金账户当前流水条数: N/A
- 数据库回查异常: DaoException: Failed to execute query: select log_id, fund_acc_no, txn_type, amount, available_after, frozen_after,        ref_order_id, operator_id, txn_time   from fund_transaction_log  where fund_acc_no = ? order by txn_time desc, log_id desc limit ?
- 典型失败样例：
  - query failed: {"code":5000,"message":"系统内部错误: Failed to execute query: select sec_acc_no, investor_id, status, open_date, linked_fund_acc\n  from security_account\n where sec_acc_no = ?"}
  - query failed: {"code":5000,"message":"系统内部错误: Failed to execute query: select investor_id, type, name, gender, id_type, id_number, phone, address, work_unit, occupation, education,\n       legal_number, business_license, authorize_name, authorize_phone, authorize_address,\n       executor_name, agent_name, agent_id_number, created_at\n  from investor\n where investor_id = ?"}

## 5. 失败原因分析

### 混合并发查询

- 当前 DAO 层主要通过 `DriverManager.getConnection(...)` 即时创建数据库连接，未使用连接池。
- `Dashboard / 账户列表` 查询路径存在逐条补查关联数据的模式，会把单次查询放大成多次数据库访问。
- 在 `40` 并发、`400` 总请求的混合查询场景下，短时间内大量建连触发了 MySQL 客户端侧的 socket/临时端口资源耗尽。
- 报错链中的 `CommunicationsException` 表示 JDBC 驱动未能成功建立数据库连接。
- 更底层的 `BindException: Address already in use: connect` 指向的是客户端连接资源耗尽，而不是 SQL 语法错误或表结构错误。
- 因此，该场景未通过的根因是“高并发读请求 + 无连接池 + N+1 查询放大”，不是业务规则校验本身出错。

## 6. 其他说明与限制

- 报告结构参考根目录 PDF 模板中的压力测试章节，并补充了过程可复现信息。
- 本次执行已接入真实 MySQL 数据库，包含真实表结构、真实索引和真实数据库 I/O。
- 本次结果反映的是控制器 + Service + DAO + 真实 MySQL 的压力表现，但仍不包含真实 HTTP 网络传输和前端浏览器渲染。

## 7. 结论

本次共执行 4 个压力测试场景，其中 3 个场景通过既定校验。 需要结合上文未通过场景继续排查系统在并发或幂等路径上的薄弱点。
