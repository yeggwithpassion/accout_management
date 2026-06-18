# Account Submodule 账户业务子系统
## 分工与时间线
| 层级            | 工作内容                           | 负责人 | 开始日期       | 截止日期       |
| ------------- | ------------------------------ | --- | ---------- | ---------- |
| 数据库           | 表设计、索引、约束、事务规则、初始化数据           | 张钊  | 06-08 | 06-09 |
| 后端 DAO        | JDBC CRUD、SQL安全、复用工具方法         | 崔大元 | 06-08 | 06-09 |
| 后端 Service    | 核心业务逻辑、事务控制、错误码管理              | 林哈利 | 06-09 | 06-10 |
| 后端 Controller | 内部管理接口、外部开放接口、JSON返回、权限验证      | 张瑞喆 | 06-10 | 06-11 |
| 前端            | Vue 页面、路由、状态管理、API封装、表单校验、异常提示 | 杨世博 | 06-08 | 06-11 |
| 测试与联调         | 功能测试、Postman测试、幂等性、事务一致性       | 杨世博 | 06-12 | 06-14 |

**说明**
- 数据库和后端 DAO可以并行开发，保证数据表设计和 CRUD 接口可用。
- 后端 Service依赖 DAO，因此在 DAO 完成后开始。
- Controller依赖 Service，因此在 Service 完成后开始。
- 前端可在后端 Service/Controller 逐步完成后并行开发，覆盖页面和 API 调用。
- 测试与联调在所有功能完成后开始，确保事务一致性和接口幂等性
## 接口设置与错误码

### 外部接口
| 接口名称 | 调用方向 | 触发场景 | 请求数据 | 响应数据 | 异常/错误码 |
|----------|----------|----------|----------|----------|-------------|
| bindSecurityAccount | 资金账户业务 → 证券账户业务 | 资金账户开立成功后建立证券账户与资金账户关联 | fund_acc_no、sec_acc_no | code、message | ERR_005、ERR_006、ERR_013、ERR_014 |
| unbindSecurityAccount | 资金账户业务 → 证券账户业务 | 资金账户销户时解除证券账户绑定 | fund_acc_no、sec_acc_no | code、message | ERR_007、ERR_015、ERR_016、ERR_017 |
| adminFreeze_seAccount / adminUnfreeze_seAccount | 交易管理系统 → 证券账户业务 | 管理员因挂失或违规风控冻结、解冻账户 | sec_acc_no、freezeType | code、message | ERR_009、ERR_010、ERR_011 |
| adminFreeze_fundAccount / adminUnfreeze_fundAccount | 交易管理系统 → 资金账户业务 | 管理员因挂失或违规风控冻结、解冻账户 | fund_acc_no、freezeType | code、message | ERR_009、ERR_010、ERR_011 |
| clientLoginAuth | 交易子系统/股票中央交易系统 → 资金账户业务 | 投资者通过交易客户端登录时进行资金账户号和交易密码鉴权 | fundAccountNo、tradePassword | authToken、fundAccountNo、securityAccountNo、status | ERR_003、ERR_004、ERR_010 |
| getFundSnapshot | 交易子系统/管理账户界面 → 资金账户业务 | 用户查看资金余额，或下单前校验可用资金 | fund_acc_no、authToken | available_balance、frozen_balance、currency | ERR_003、ERR_010 |
| getSecuritySnapshot | 交易子系统 → 证券账户业务 | 用户查看证券持仓，或卖出前校验可卖数量 | sec_acc_no、authToken、stock_code（可选） | stock_code、quantity、frozen_quantity、available_quantity、avg_cost | ERR_002、ERR_003、ERR_010 |
| updateFundBalance | 中央交易系统 → 资金账户业务 | 买入下单冻结资金、成交扣划资金、卖出成交回款、撤单释放冻结资金 | fund_acc_no、delta_fund_a、delta_fund_f | balance、available_balance、frozen_balance、log_id（流水编号） | ERR_001、ERR_003、ERR_010、ERR_018 |
| updateSecurityHolding | 中央交易系统 → 证券账户业务 | 卖出下单冻结持仓、卖出成交扣减持仓、买入成交增加持仓、撤单释放冻结持仓 | sec_acc_no、stock_code、delta_security_a、delta_security_f | quantity、frozen_quantity、available_quantity | ERR_002、ERR_003、ERR_010、ERR_018 |
| clientChangeFundPassword | 交易子系统/管理账户界面 → 资金账户业务 | 投资者在交易客户端修改交易密码或取款密码 | fund_acc_no、authToken、passwordType、oldPassword、newPassword | 密码修改结果 | ERR_003、ERR_004、ERR_010 |

### 内部接口

## 数据库
