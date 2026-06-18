CREATE DATABASE IF NOT EXISTS stock_account_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE stock_account_system;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS operation_log;
DROP TABLE IF EXISTS holding;
DROP TABLE IF EXISTS fund_transaction_log;
DROP TABLE IF EXISTS fund_account;
DROP TABLE IF EXISTS security_account;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS investor;

CREATE TABLE investor (
    investor_id INT NOT NULL AUTO_INCREMENT COMMENT '投资者内部编号',
    type ENUM('个人', '法人') NOT NULL COMMENT '投资者类型',
    name VARCHAR(100) NOT NULL COMMENT '姓名或企业名称',
    id_type VARCHAR(20) NOT NULL COMMENT '证件类型',
    id_number VARCHAR(50) NOT NULL COMMENT '证件号码',
    phone VARCHAR(20) NULL COMMENT '联系电话',
    address VARCHAR(200) NULL COMMENT '联系地址',
    occupation VARCHAR(50) NULL COMMENT '职业',
    education VARCHAR(50) NULL COMMENT '学历',
    legal_number VARCHAR(20) NULL COMMENT '法人注册登记号',
    business_license VARCHAR(20) NULL COMMENT '营业执照号码',
    authorize_name VARCHAR(20) NULL COMMENT '授权人有效身份证号',
    authorize_phone VARCHAR(20) NULL COMMENT '授权人联系电话',
    authorize_address VARCHAR(100) NULL COMMENT '授权人地址',
    executor_name VARCHAR(50) NULL COMMENT '法人授权执行人姓名',
    agent_name VARCHAR(100) NULL COMMENT '代办人姓名',
    agent_id_number VARCHAR(50) NULL COMMENT '代办人证件号码',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (investor_id),
    UNIQUE KEY uk_investor_id_number (id_number)
) ENGINE=InnoDB COMMENT='投资者表';

CREATE TABLE staff (
    staff_id INT NOT NULL AUTO_INCREMENT COMMENT '工作人员编号',
    username VARCHAR(50) NOT NULL COMMENT '登录用户名',
    password_hash VARCHAR(128) NOT NULL COMMENT '密码哈希',
    permission_level INT NOT NULL DEFAULT 1 COMMENT '权限级别保留字段',
    status ENUM('正常', '禁用') NOT NULL DEFAULT '正常' COMMENT '账号状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (staff_id),
    UNIQUE KEY uk_staff_username (username)
) ENGINE=InnoDB COMMENT='工作人员表';

CREATE TABLE security_account (
    sec_acc_no VARCHAR(20) NOT NULL COMMENT '证券账户号',
    investor_id INT NOT NULL COMMENT '投资者编号',
    status ENUM('正常', '挂失冻结', '违规冻结', '预销户', '已销户') NOT NULL COMMENT '账户状态',
    open_date DATE NOT NULL COMMENT '开户日期',
    linked_fund_acc VARCHAR(20) NULL COMMENT '关联资金账户号',
    PRIMARY KEY (sec_acc_no),
    UNIQUE KEY uk_security_linked_fund_acc (linked_fund_acc),
    KEY idx_security_investor_id (investor_id),
    KEY idx_security_status (status),
    CONSTRAINT fk_security_account_investor
        FOREIGN KEY (investor_id) REFERENCES investor (investor_id)
) ENGINE=InnoDB COMMENT='证券账户表';

CREATE TABLE fund_account (
    fund_acc_no VARCHAR(20) NOT NULL COMMENT '资金账户号',
    sec_acc_no VARCHAR(20) NOT NULL COMMENT '绑定证券账户号',
    trade_password VARCHAR(128) NOT NULL COMMENT '交易密码哈希',
    withdraw_password VARCHAR(128) NOT NULL COMMENT '取款密码哈希',
    available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '可用余额',
    frozen_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '交易冻结余额',
    currency CHAR(3) NOT NULL DEFAULT 'CNY' COMMENT '币种',
    status ENUM('正常', '挂失冻结', '违规冻结', '已销户') NOT NULL COMMENT '账户状态',
    open_date DATE NOT NULL COMMENT '开户日期',
    last_interest_date DATE NULL COMMENT '上次结息日',
    annual_interest_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0035 COMMENT '年利率',
    PRIMARY KEY (fund_acc_no),
    UNIQUE KEY uk_fund_sec_acc_no (sec_acc_no),
    KEY idx_fund_status (status),
    CONSTRAINT fk_fund_account_security
        FOREIGN KEY (sec_acc_no) REFERENCES security_account (sec_acc_no)
) ENGINE=InnoDB COMMENT='资金账户表';

CREATE TABLE fund_transaction_log (
    log_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '流水编号',
    fund_acc_no VARCHAR(20) NOT NULL COMMENT '资金账户号',
    txn_type ENUM('存款', '取款', '买入冻结', '买入扣款', '卖出回款', '撤单解冻', '结息') NOT NULL COMMENT '交易类型',
    amount DECIMAL(15,2) NOT NULL COMMENT '变动金额',
    available_after DECIMAL(15,2) NOT NULL COMMENT '交易后可用余额',
    frozen_after DECIMAL(15,2) NOT NULL COMMENT '交易后冻结余额',
    ref_order_id VARCHAR(50) NULL COMMENT '关联订单号',
    operator_id INT NULL COMMENT '操作人员编号',
    txn_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '交易时间',
    PRIMARY KEY (log_id),
    KEY idx_ftl_fund_acc_no (fund_acc_no),
    KEY idx_ftl_txn_time (txn_time),
    KEY idx_ftl_txn_type (txn_type),
    KEY idx_ftl_ref_order_id (ref_order_id),
    CONSTRAINT fk_ftl_fund_account
        FOREIGN KEY (fund_acc_no) REFERENCES fund_account (fund_acc_no),
    CONSTRAINT fk_ftl_staff
        FOREIGN KEY (operator_id) REFERENCES staff (staff_id)
) ENGINE=InnoDB COMMENT='资金流水表';

CREATE TABLE holding (
    holding_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '持仓编号',
    sec_acc_no VARCHAR(20) NOT NULL COMMENT '证券账户号',
    stock_code VARCHAR(10) NOT NULL COMMENT '股票代码',
    quantity INT NOT NULL DEFAULT 0 COMMENT '持有股数',
    frozen_quantity INT NOT NULL DEFAULT 0 COMMENT '交易冻结股数',
    avg_cost DECIMAL(15,4) NULL COMMENT '移动平均成本',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    PRIMARY KEY (holding_id),
    UNIQUE KEY uk_holding_sec_stock (sec_acc_no, stock_code),
    KEY idx_holding_stock_code (stock_code),
    CONSTRAINT fk_holding_security
        FOREIGN KEY (sec_acc_no) REFERENCES security_account (sec_acc_no)
) ENGINE=InnoDB COMMENT='持仓表';

CREATE TABLE operation_log (
    log_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '日志编号',
    staff_id INT NOT NULL COMMENT '操作工作人员编号',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    target_type VARCHAR(50) NULL COMMENT '操作对象类型',
    target_id VARCHAR(50) NULL COMMENT '操作对象编号',
    detail VARCHAR(500) NULL COMMENT '操作详情',
    operation_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (log_id),
    KEY idx_oplog_staff_id (staff_id),
    KEY idx_oplog_operation_time (operation_time),
    KEY idx_oplog_operation_type (operation_type),
    KEY idx_oplog_target (target_type, target_id),
    CONSTRAINT fk_operation_log_staff
        FOREIGN KEY (staff_id) REFERENCES staff (staff_id)
) ENGINE=InnoDB COMMENT='操作日志表';

ALTER TABLE security_account
    ADD CONSTRAINT fk_security_account_linked_fund
    FOREIGN KEY (linked_fund_acc) REFERENCES fund_account (fund_acc_no);

SET FOREIGN_KEY_CHECKS = 1;