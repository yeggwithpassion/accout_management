USE account_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM operation_log;
DELETE FROM holding_change_log;
DELETE FROM holding;
DELETE FROM fund_transaction_log;
DELETE FROM fund_account;
DELETE FROM security_account;
DELETE FROM staff;
DELETE FROM investor;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO staff (staff_id, username, password_hash, status, created_at) VALUES
(1, 'staff01', '6cc8ba5620e37a238525310273e3410fa74a928ebd76c23afd897e668d0e82e4', '正常', NOW());

INSERT INTO investor (
    investor_id, type, name, gender, id_type, id_number, phone, address,
    work_unit, occupation, education, created_at
) VALUES
(1, '个人', '测试用户', '男', '身份证', '330101199001010001', '13800000000', 'Hangzhou',
 'ZJU', 'Engineer', 'Bachelor', NOW());

INSERT INTO security_account (
    sec_acc_no, investor_id, status, open_date, linked_fund_acc
) VALUES
('SA9000000001', 1, '正常', CURDATE(), NULL);

INSERT INTO fund_account (
    fund_acc_no, sec_acc_no, trade_password, withdraw_password,
    available_balance, frozen_balance, currency, status,
    open_date, last_interest_date, annual_interest_rate
) VALUES
('FA9000000001', 'SA9000000001',
 'c325d78c67907c4de310049cd550486cd8a9cead710db5aa7d437aba9b41f431',
 '19718426e072c74d3c1bbb5b4197755aa0b7beaabec339e465cc1c4b89e9af33',
 1000.00, 0.00, 'CNY', '正常', CURDATE(), NULL, 0.0035);

UPDATE security_account
SET linked_fund_acc = 'FA9000000001'
WHERE sec_acc_no = 'SA9000000001';
