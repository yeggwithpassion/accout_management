package com.zju.account.service.impl;

import account.dao.DaoRegistry;
import account.dao.core.TransactionManager;
import account.dao.model.DomainEnums;
import account.dao.model.DomainModels;
import com.zju.account.common.BusinessException;
import com.zju.account.common.ErrorCode;
import com.zju.account.dto.request.*;
import com.zju.account.dto.response.FundLogView;
import com.zju.account.enums.AccountStatus;
import com.zju.account.service.FundAccountService;
import com.zju.account.service.util.AccountNumberGenerator;
import com.zju.account.service.util.EnumMapper;
import com.zju.account.service.util.PasswordUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 资金账户业务 Service 实现。
 * <p>
 * 覆盖 FundAccountService 接口中的所有方法，
 * 严格对齐 README 中的外部/内部接口规范与错误码表。
 */
@Slf4j
@Service
public class FundAccountServiceImpl implements FundAccountService {

    private final DaoRegistry dao;

    public FundAccountServiceImpl(DaoRegistry dao) {
        this.dao = dao;
    }

    // ==================== 内部接口 ====================

    @Override
    public Map<String, Object> createFundAccount(CreateFundAccountRequest request) {
        String secAccNo = request.getSecAccNo();
        String idNumber = request.getIdNumber();

        // 1. 检查证券账户是否存在
        var secAccount = dao.securityAccountDao().findByAccountNo(secAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

        // 2. 检查证券账户未关联其他资金账户（ERR_014）
        if (secAccount.linkedFundAcc() != null && !secAccount.linkedFundAcc().isBlank()) {
            throw new BusinessException(ErrorCode.ERR_014, "该证券账户已绑定资金账户: " + secAccount.linkedFundAcc());
        }

        // 3. 验证投资者身份
        var investor = dao.investorDao().findById(secAccount.investorId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_013, "证券账户持有人不存在"));
        if (!investor.idNumber().equals(idNumber)) {
            throw new BusinessException(ErrorCode.ERR_013, "身份证号与证券账户持有人不一致");
        }

        // 4. 检查黑名单
        if (dao.blacklistDao().isBlocked(idNumber)) {
            throw new BusinessException(ErrorCode.ERR_012, "投资者在黑名单中，无法开立资金账户");
        }

        // 5. 检查证券账户状态
        DomainEnums.AccountStatus daoStatus = secAccount.status();
        if (daoStatus == DomainEnums.AccountStatus.CLOSED) {
            throw new BusinessException(ErrorCode.ERR_005, "证券账户已销户");
        }

        // 6. 生成资金账户号并在事务中创建
        String fundAccNo = AccountNumberGenerator.generateFundAccountNo();
        String tradePwdHash = PasswordUtil.hash(request.getTradePassword());
        String withdrawPwdHash = PasswordUtil.hash(request.getWithdrawPassword());
        String currency = Optional.ofNullable(request.getCurrency()).orElse("CNY");

        return dao.transactionManager().execute(connection -> {
            // 创建资金账户
            var fundAccount = new DomainModels.FundAccount(
                    fundAccNo, secAccNo, tradePwdHash, withdrawPwdHash,
                    BigDecimal.ZERO, BigDecimal.ZERO, currency,
                    DomainEnums.AccountStatus.NORMAL, LocalDate.now(),
                    null, new BigDecimal("0.0035")
            );
            if (!dao.fundAccountDao().create(connection, fundAccount)) {
                throw new BusinessException(ErrorCode.SYSTEM_ERROR, "创建资金账户失败");
            }

            // 绑定证券账户
            dao.securityAccountDao().bindFundAccount(connection, secAccNo, fundAccNo);

            // 记录操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "资金开户", "FUND",
                    fundAccNo, "开立资金账户，绑定证券账户 " + secAccNo, LocalDateTime.now()
            ));

            log.info("[createFundAccount] 成功: fund_acc_no={} sec_acc_no={}", fundAccNo, secAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fund_acc_no", fundAccNo);
            result.put("status", AccountStatus.NORMAL.cn());
            result.put("sec_acc_no", secAccNo);
            result.put("currency", currency);
            return result;
        });
    }

    @Override
    public Map<String, Object> deposit(DepositRequest request) {
        String fundAccNo = request.getFundAccNo();
        BigDecimal amount = request.getAmount();

        return dao.transactionManager().execute(connection -> {
            // 1. 查找并锁定资金账户
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 2. 检查账户状态
            checkAccountNotFrozenOrClosed(account.status(), fundAccNo);

            // 3. 计算新余额
            BigDecimal newAvailable = account.availableBalance().add(amount);
            BigDecimal newFrozen = account.frozenBalance();

            // 4. 更新余额
            dao.fundAccountDao().updateBalances(connection, fundAccNo, newAvailable, newFrozen);

            // 5. 创建流水
            long logId = dao.fundTransactionLogDao().create(connection, new DomainModels.FundTransactionLog(
                    null, fundAccNo, DomainEnums.FundTransactionType.DEPOSIT,
                    amount, newAvailable, newFrozen,
                    null, request.getStaffId(), LocalDateTime.now()
            ));

            // 6. 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "资金存款", "FUND",
                    fundAccNo, "存款 " + amount, LocalDateTime.now()
            ));

            log.info("[deposit] fund_acc_no={} amount={} available_after={}", fundAccNo, amount, newAvailable);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("available_balance", newAvailable);
            result.put("log_id", logId);
            return result;
        });
    }

    @Override
    public Map<String, Object> withdraw(WithdrawRequest request) {
        String fundAccNo = request.getFundAccNo();
        BigDecimal amount = request.getAmount();

        return dao.transactionManager().execute(connection -> {
            // 1. 查找并锁定资金账户
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 2. 检查账户状态
            checkAccountNotFrozenOrClosed(account.status(), fundAccNo);

            // 3. 验证取款密码
            if (!PasswordUtil.verify(request.getWithdrawPassword(), account.withdrawPassword())) {
                throw new BusinessException(ErrorCode.ERR_004, "取款密码错误");
            }

            // 4. 检查余额
            if (account.availableBalance().compareTo(amount) < 0) {
                throw new BusinessException(ErrorCode.ERR_001, "可用余额不足: 需要 " + amount + "，当前 " + account.availableBalance());
            }

            // 5. 计算新余额
            BigDecimal newAvailable = account.availableBalance().subtract(amount);
            BigDecimal newFrozen = account.frozenBalance();

            // 6. 更新余额
            dao.fundAccountDao().updateBalances(connection, fundAccNo, newAvailable, newFrozen);

            // 7. 创建流水
            long logId = dao.fundTransactionLogDao().create(connection, new DomainModels.FundTransactionLog(
                    null, fundAccNo, DomainEnums.FundTransactionType.WITHDRAW,
                    amount, newAvailable, newFrozen,
                    null, request.getStaffId(), LocalDateTime.now()
            ));

            // 8. 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "资金取款", "FUND",
                    fundAccNo, "取款 " + amount, LocalDateTime.now()
            ));

            log.info("[withdraw] fund_acc_no={} amount={} available_after={}", fundAccNo, amount, newAvailable);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("available_balance", newAvailable);
            result.put("log_id", logId);
            return result;
        });
    }

    @Override
    public void changeFundPassword(ChangeFundPasswordRequest request) {
        String fundAccNo = request.getFundAccNo();

        dao.transactionManager().execute(connection -> {
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            checkAccountNotFrozenOrClosed(account.status(), fundAccNo);

            String storedPassword;
            String pwdTypeLabel;
            if ("trade".equals(request.getPasswordType())) {
                storedPassword = account.tradePassword();
                pwdTypeLabel = "交易密码";
            } else {
                storedPassword = account.withdrawPassword();
                pwdTypeLabel = "取款密码";
            }

            if (!PasswordUtil.verify(request.getOldPassword(), storedPassword)) {
                throw new BusinessException(ErrorCode.ERR_004, pwdTypeLabel + "错误");
            }

            String newHash = PasswordUtil.hash(request.getNewPassword());
            if ("trade".equals(request.getPasswordType())) {
                dao.fundAccountDao().updateTradePassword(connection, fundAccNo, newHash);
            } else {
                dao.fundAccountDao().updateWithdrawPassword(connection, fundAccNo, newHash);
            }

            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "修改密码", "FUND",
                    fundAccNo, "修改" + pwdTypeLabel, LocalDateTime.now()
            ));

            log.info("[changeFundPassword] fund_acc_no={} password_type={} staff_id={}",
                    fundAccNo, request.getPasswordType(), request.getStaffId());
            return null;
        });
    }

    @Override
    public Map<String, Object> reportFundLoss(ReportFundLossRequest request) {
        String fundAccNo = request.getFundAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 验证身份
            verifyOwnership(account.secAccNo(), idNumber);

            // 检查状态
            if (account.status() == DomainEnums.AccountStatus.LOSS_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已是挂失冻结状态");
            }
            if (account.status() == DomainEnums.AccountStatus.CLOSED
                    || account.status() == DomainEnums.AccountStatus.PRE_CLOSE) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已销户或预销户，无法挂失");
            }

            // 冻结账户
            dao.fundAccountDao().updateStatus(connection, fundAccNo, DomainEnums.AccountStatus.LOSS_FROZEN);

            // 创建冻结记录
            dao.freezeRecordDao().create(connection, new DomainModels.FreezeRecord(
                    null, DomainEnums.AccountType.FUND, fundAccNo,
                    DomainEnums.FreezeType.LOSS, Optional.ofNullable(request.getReason()).orElse("挂失"),
                    account.availableBalance().add(account.frozenBalance()), null,
                    request.getStaffId(), LocalDateTime.now(), null, true
            ));

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "挂失", "FUND",
                    fundAccNo, "资金账户挂失，原因: " + Optional.ofNullable(request.getReason()).orElse(""), LocalDateTime.now()
            ));

            log.info("[reportFundLoss] fund_acc_no={} reason={}", fundAccNo, request.getReason());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", AccountStatus.FROZEN_LOSS.cn());
            return result;
        });
    }

    @Override
    public Map<String, Object> reissueFundAccount(ReissueFundAccountRequest request) {
        String oldFundAccNo = request.getOldFundAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var oldAccount = dao.fundAccountDao().findByAccountNoForUpdate(connection, oldFundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + oldFundAccNo));

            // 验证身份
            verifyOwnership(oldAccount.secAccNo(), idNumber);

            // 检查旧账户必须处于挂失冻结状态
            if (oldAccount.status() != DomainEnums.AccountStatus.LOSS_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_011, "资金账户未处于挂失冻结状态，无法补办");
            }

            // 生成新账户号
            String newFundAccNo = AccountNumberGenerator.generateFundAccountNo();
            String tradePwdHash = PasswordUtil.hash(request.getNewTradePassword());
            String withdrawPwdHash = PasswordUtil.hash(request.getNewWithdrawPassword());

            // 创建新资金账户，转移余额
            var newAccount = new DomainModels.FundAccount(
                    newFundAccNo, oldAccount.secAccNo(), tradePwdHash, withdrawPwdHash,
                    oldAccount.availableBalance(), oldAccount.frozenBalance(),
                    oldAccount.currency(), DomainEnums.AccountStatus.NORMAL, LocalDate.now(),
                    oldAccount.lastInterestDate(), oldAccount.annualInterestRate()
            );
            dao.fundAccountDao().create(connection, newAccount);

            // 关闭旧账户
            dao.fundAccountDao().updateStatus(connection, oldFundAccNo, DomainEnums.AccountStatus.CLOSED);

            // 更新证券账户绑定
            dao.securityAccountDao().bindFundAccount(connection, oldAccount.secAccNo(), newFundAccNo);

            // 释放挂失冻结记录
            dao.freezeRecordDao().closeActiveRecord(connection,
                    DomainEnums.AccountType.FUND, oldFundAccNo,
                    DomainEnums.FreezeType.LOSS, LocalDateTime.now());

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "补办", "FUND",
                    newFundAccNo, "补办资金账户，旧账户: " + oldFundAccNo, LocalDateTime.now()
            ));

            log.info("[reissueFundAccount] old={} new={}", oldFundAccNo, newFundAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("new_fund_acc_no", newFundAccNo);
            result.put("old_fund_acc_no", oldFundAccNo);
            return result;
        });
    }

    @Override
    public Map<String, Object> closeFundAccount(CloseFundAccountRequest request) {
        String fundAccNo = request.getFundAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 验证身份
            verifyOwnership(account.secAccNo(), idNumber);

            // 检查账户状态
            if (account.status() == DomainEnums.AccountStatus.CLOSED) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已销户");
            }
            if (account.status() == DomainEnums.AccountStatus.LOSS_FROZEN
                    || account.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_017, "资金账户处于冻结状态，无法销户");
            }

            // 检查余额
            if (account.availableBalance().compareTo(BigDecimal.ZERO) > 0) {
                throw new BusinessException(ErrorCode.ERR_007, "资金账户尚有可用余额，无法销户");
            }
            if (account.frozenBalance().compareTo(BigDecimal.ZERO) > 0) {
                throw new BusinessException(ErrorCode.ERR_007, "资金账户尚有冻结资金，无法销户");
            }

            // 销户
            dao.fundAccountDao().updateStatus(connection, fundAccNo, DomainEnums.AccountStatus.CLOSED);

            // 解除证券账户绑定
            String secAccNo = account.secAccNo();
            if (secAccNo != null && !secAccNo.isBlank()) {
                dao.securityAccountDao().unbindFundAccount(connection, secAccNo);
            }

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "销户", "FUND",
                    fundAccNo, "资金账户销户，原因: " + Optional.ofNullable(request.getReason()).orElse(""), LocalDateTime.now()
            ));

            log.info("[closeFundAccount] fund_acc_no={} reason={}", fundAccNo, request.getReason());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", AccountStatus.CLOSED.cn());
            return result;
        });
    }

    @Override
    public Map<String, Object> queryFundInfo(String fundAccNo, String idNumber, boolean includeLogs) {
        var account = dao.fundAccountDao().findByAccountNo(fundAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

        // 验证身份（通过证券账户链）
        if (account.secAccNo() != null) {
            var secAccount = dao.securityAccountDao().findByAccountNo(account.secAccNo());
            if (secAccount.isPresent()) {
                var investor = dao.investorDao().findById(secAccount.get().investorId());
                if (investor.isPresent() && !investor.get().idNumber().equals(idNumber)) {
                    throw new BusinessException(ErrorCode.ERR_013, "身份证号与账户持有人不一致");
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fund_acc_no", fundAccNo);
        result.put("available_balance", account.availableBalance());
        result.put("frozen_balance", account.frozenBalance());
        result.put("currency", account.currency());
        result.put("status", EnumMapper.fromDaoStatus(account.status()).cn());

        if (includeLogs) {
            List<FundLogView> logViews = dao.fundTransactionLogDao()
                    .listRecentByFundAccountNo(fundAccNo, 50).stream()
                    .map(log -> FundLogView.builder()
                            .logId(log.logId())
                            .txnType(log.txnType().dbValue())
                            .amount(log.amount())
                            .txnTime(log.txnTime())
                            .refOrderId(log.refOrderId())
                            .build())
                    .toList();
            result.put("logs", logViews);
        }

        return result;
    }

    // ==================== 外部接口 ====================

    @Override
    public Map<String, Object> clientLoginAuth(String fundAccNo, String tradePassword) {
        var account = dao.fundAccountDao().findByAccountNo(fundAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在"));

        // 检查状态
        DomainEnums.AccountStatus daoStatus = account.status();
        if (daoStatus == DomainEnums.AccountStatus.LOSS_FROZEN
                || daoStatus == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
            throw new BusinessException(ErrorCode.ERR_003, "账户已冻结");
        }
        if (daoStatus == DomainEnums.AccountStatus.CLOSED
                || daoStatus == DomainEnums.AccountStatus.PRE_CLOSE) {
            throw new BusinessException(ErrorCode.ERR_010, "账户已销户或预销户");
        }

        // 验证密码
        if (!PasswordUtil.verify(tradePassword, account.tradePassword())) {
            throw new BusinessException(ErrorCode.ERR_004, "交易密码错误");
        }

        String authToken = PasswordUtil.generateAuthToken();
        log.info("[clientLoginAuth] fund_acc_no={} 登录成功", fundAccNo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("authToken", authToken);
        result.put("fund_acc_no", fundAccNo);
        result.put("sec_acc_no", account.secAccNo());
        result.put("status", "NORMAL");
        return result;
    }

    @Override
    public Map<String, Object> getFundSnapshot(String fundAccNo) {
        var account = dao.fundAccountDao().findByAccountNo(fundAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在"));

        // 检查状态
        DomainEnums.AccountStatus daoStatus = account.status();
        if (daoStatus == DomainEnums.AccountStatus.LOSS_FROZEN
                || daoStatus == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
            throw new BusinessException(ErrorCode.ERR_003, "账户已冻结");
        }

        // 获取最近流水
        List<FundLogView> recentLogs = dao.fundTransactionLogDao()
                .listRecentByFundAccountNo(fundAccNo, 10).stream()
                .map(log -> FundLogView.builder()
                        .logId(log.logId())
                        .txnType(log.txnType().dbValue())
                        .amount(log.amount())
                        .txnTime(log.txnTime())
                        .refOrderId(log.refOrderId())
                        .build())
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available_balance", account.availableBalance());
        result.put("frozen_balance", account.frozenBalance());
        result.put("currency", account.currency());
        result.put("status", "NORMAL");
        result.put("recent_logs", recentLogs);
        return result;
    }

    @Override
    public void clientChangeFundPassword(ClientChangeFundPasswordRequest request) {
        String fundAccNo = request.getFundAccNo();

        dao.transactionManager().execute(connection -> {
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            DomainEnums.AccountStatus daoStatus = account.status();
            if (daoStatus == DomainEnums.AccountStatus.LOSS_FROZEN
                    || daoStatus == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_003, "账户已冻结");
            }
            if (daoStatus == DomainEnums.AccountStatus.CLOSED
                    || daoStatus == DomainEnums.AccountStatus.PRE_CLOSE) {
                throw new BusinessException(ErrorCode.ERR_010, "账户已销户或预销户");
            }

            String storedPassword;
            String pwdTypeLabel;
            if ("trade".equals(request.getPasswordType())) {
                storedPassword = account.tradePassword();
                pwdTypeLabel = "交易密码";
            } else {
                storedPassword = account.withdrawPassword();
                pwdTypeLabel = "取款密码";
            }

            if (!PasswordUtil.verify(request.getOldPassword(), storedPassword)) {
                throw new BusinessException(ErrorCode.ERR_004, pwdTypeLabel + "错误");
            }

            String newHash = PasswordUtil.hash(request.getNewPassword());
            if ("trade".equals(request.getPasswordType())) {
                dao.fundAccountDao().updateTradePassword(connection, fundAccNo, newHash);
            } else {
                dao.fundAccountDao().updateWithdrawPassword(connection, fundAccNo, newHash);
            }

            log.info("[clientChangeFundPassword] fund_acc_no={} password_type={}",
                    fundAccNo, request.getPasswordType());
            return null;
        });
    }

    @Override
    public Map<String, Object> updateFundBalance(UpdateFundBalanceRequest request) {
        String fundAccNo = request.getFundAccNo();
        String refOrderId = request.getRefOrderId();
        String txnType = request.getTxnType();
        BigDecimal amount = request.getAmount();

        DomainEnums.FundTransactionType daoType = mapTxnType(txnType);

        return dao.transactionManager().execute(connection -> {
            // 1. 锁定资金账户行（排他锁，序列化并发请求）
            var account = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 2. 幂等检查（在 FOR UPDATE 锁持有期间执行，消除 TOCTOU 竞态）
            if (dao.fundTransactionLogDao().existsByRefOrderIdAndTxnType(refOrderId, daoType)) {
                log.info("[updateFundBalance] 幂等: ref_order_id={} txn_type={} 已处理，跳过", refOrderId, txnType);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("available_balance", account.availableBalance());
                result.put("frozen_balance", account.frozenBalance());
                result.put("duplicate", true);
                return result;
            }

            // 3. 检查状态
            checkAccountNotFrozenOrClosed(account.status(), fundAccNo);

            BigDecimal newAvailable = account.availableBalance();
            BigDecimal newFrozen = account.frozenBalance();

            switch (txnType) {
                case "买入冻结" -> {
                    if (newAvailable.compareTo(amount) < 0) {
                        throw new BusinessException(ErrorCode.ERR_001, "可用余额不足");
                    }
                    newAvailable = newAvailable.subtract(amount);
                    newFrozen = newFrozen.add(amount);
                }
                case "买入扣款" -> {
                    if (newFrozen.compareTo(amount) < 0) {
                        throw new BusinessException(ErrorCode.ERR_001, "冻结资金不足");
                    }
                    newFrozen = newFrozen.subtract(amount);
                }
                case "卖出回款" -> newAvailable = newAvailable.add(amount);
                case "撤单解冻" -> {
                    if (newFrozen.compareTo(amount) < 0) {
                        throw new BusinessException(ErrorCode.ERR_001, "冻结资金不足");
                    }
                    newFrozen = newFrozen.subtract(amount);
                    newAvailable = newAvailable.add(amount);
                }
                default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "不支持的资金变更类型: " + txnType);
            }

            // 更新余额
            dao.fundAccountDao().updateBalances(connection, fundAccNo, newAvailable, newFrozen);

            // 创建流水
            long logId = dao.fundTransactionLogDao().create(connection, new DomainModels.FundTransactionLog(
                    null, fundAccNo, daoType,
                    amount, newAvailable, newFrozen,
                    refOrderId, null, LocalDateTime.now()
            ));

            log.info("[updateFundBalance] fund_acc_no={} txn_type={} amount={} available_after={} frozen_after={} log_id={}",
                    fundAccNo, txnType, amount, newAvailable, newFrozen, logId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("available_balance", newAvailable);
            result.put("frozen_balance", newFrozen);
            result.put("log_id", logId);
            return result;
        });
    }

    // ==================== bind / unbind 外部接口 ====================

    @Override
    public Map<String, Object> bindSecurityAccount(String fundAccNo, String secAccNo) {
        return dao.transactionManager().execute(connection -> {
            // 1. 检查证券账户存在
            var secAccount = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            // 2. 检查证券账户未关联其他资金账户 (ERR_006/ERR_014)
            if (secAccount.linkedFundAcc() != null && !secAccount.linkedFundAcc().isBlank()) {
                if (secAccount.linkedFundAcc().equals(fundAccNo)) {
                    throw new BusinessException(ErrorCode.ERR_011, "证券账户已绑定该资金账户");
                }
                throw new BusinessException(ErrorCode.ERR_014, "证券账户已绑定其他资金账户: " + secAccount.linkedFundAcc());
            }

            // 3. 检查资金账户存在且未绑定其他证券账户
            var fundAccount = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            if (fundAccount.secAccNo() != null && !fundAccount.secAccNo().isBlank()) {
                if (!fundAccount.secAccNo().equals(secAccNo)) {
                    throw new BusinessException(ErrorCode.ERR_014, "该资金账户已绑定其他证券账户: " + fundAccount.secAccNo());
                }
            }

            // 4. 验证投资者身份一致性 (ERR_013)
            var investor = dao.investorDao().findById(secAccount.investorId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_013, "投资者不存在"));

            // 5. 检查资金账户状态
            checkAccountNotFrozenOrClosed(fundAccount.status(), fundAccNo);

            // 6. 双向绑定
            dao.securityAccountDao().bindFundAccount(connection, secAccNo, fundAccNo);
            dao.fundAccountDao().relinkSecurityAccount(connection, fundAccNo, secAccNo);

            log.info("[bindSecurityAccount] fund_acc_no={} sec_acc_no={}", fundAccNo, secAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fund_acc_no", fundAccNo);
            result.put("sec_acc_no", secAccNo);
            result.put("status", "bound");
            return result;
        });
    }

    @Override
    public Map<String, Object> unbindSecurityAccount(String fundAccNo, String secAccNo) {
        return dao.transactionManager().execute(connection -> {
            // 1. 检查资金账户存在
            var fundAccount = dao.fundAccountDao().findByAccountNoForUpdate(connection, fundAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + fundAccNo));

            // 2. 检查资金账户是否绑定该证券账户 (ERR_015)
            if (fundAccount.secAccNo() == null || fundAccount.secAccNo().isBlank()) {
                throw new BusinessException(ErrorCode.ERR_015, "该资金账户未绑定任何证券账户");
            }
            if (!fundAccount.secAccNo().equals(secAccNo)) {
                throw new BusinessException(ErrorCode.ERR_015, "资金账户绑定的证券账户不匹配");
            }

            // 3. 检查证券账户存在
            var secAccount = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            // 4. 检查余额 (ERR_007)
            if (fundAccount.availableBalance().compareTo(BigDecimal.ZERO) > 0) {
                throw new BusinessException(ErrorCode.ERR_007, "资金账户尚有可用余额，无法解绑");
            }
            if (fundAccount.frozenBalance().compareTo(BigDecimal.ZERO) > 0) {
                throw new BusinessException(ErrorCode.ERR_007, "资金账户尚有冻结资金，无法解绑");
            }

            // 5. 检查冻结状态 (ERR_017)
            if (fundAccount.status() == DomainEnums.AccountStatus.LOSS_FROZEN
                    || fundAccount.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_017, "资金账户处于冻结状态，无法解绑");
            }

            // 6. 双向解绑
            dao.securityAccountDao().unbindFundAccount(connection, secAccNo);
            dao.fundAccountDao().relinkSecurityAccount(connection, fundAccNo, null);

            log.info("[unbindSecurityAccount] fund_acc_no={} sec_acc_no={}", fundAccNo, secAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fund_acc_no", fundAccNo);
            result.put("sec_acc_no", secAccNo);
            result.put("status", "unbound");
            return result;
        });
    }

    // ==================== 辅助方法 ====================

    /**
     * 检查账户未冻结且未销户。
     */
    private void checkAccountNotFrozenOrClosed(DomainEnums.AccountStatus status, String fundAccNo) {
        if (status == DomainEnums.AccountStatus.LOSS_FROZEN
                || status == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
            throw new BusinessException(ErrorCode.ERR_003, "账户已冻结: " + fundAccNo);
        }
        if (status == DomainEnums.AccountStatus.CLOSED) {
            throw new BusinessException(ErrorCode.ERR_010, "账户已销户: " + fundAccNo);
        }
        if (status == DomainEnums.AccountStatus.PRE_CLOSE) {
            throw new BusinessException(ErrorCode.ERR_010, "账户已预销户: " + fundAccNo);
        }
    }

    /**
     * 通过证券账户链验证身份证号。
     */
    private void verifyOwnership(String secAccNo, String idNumber) {
        if (secAccNo == null || secAccNo.isBlank()) {
            throw new BusinessException(ErrorCode.ERR_015, "资金账户未绑定任何证券账户");
        }
        var secAccount = dao.securityAccountDao().findByAccountNo(secAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "关联证券账户不存在: " + secAccNo));
        var investor = dao.investorDao().findById(secAccount.investorId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_013, "投资者不存在"));
        if (!investor.idNumber().equals(idNumber)) {
            throw new BusinessException(ErrorCode.ERR_013, "身份证号与证券账户持有人不一致");
        }
    }

    /**
     * 将中文交易类型映射为 DAO 枚举。
     */
    private DomainEnums.FundTransactionType mapTxnType(String txnTypeCn) {
        return switch (txnTypeCn) {
            case "买入冻结" -> DomainEnums.FundTransactionType.BUY_FREEZE;
            case "买入扣款" -> DomainEnums.FundTransactionType.BUY_DEBIT;
            case "卖出回款" -> DomainEnums.FundTransactionType.SELL_RETURN;
            case "撤单解冻" -> DomainEnums.FundTransactionType.CANCEL_RELEASE;
            default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "不支持的资金变更类型: " + txnTypeCn);
        };
    }
}
