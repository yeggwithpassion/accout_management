package com.zju.account.service.impl;

import account.dao.DaoRegistry;
import account.dao.model.DomainEnums;
import account.dao.model.DomainModels;
import com.zju.account.common.BusinessException;
import com.zju.account.common.ErrorCode;
import com.zju.account.dto.request.AdminCloseSecurityAccountRequest;
import com.zju.account.dto.request.AdminFreezeRequest;
import com.zju.account.dto.request.SettleAnnualInterestRequest;
import com.zju.account.enums.AccountStatus;
import com.zju.account.service.AdminService;
import com.zju.account.service.util.EnumMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 管理员接口 Service 实现。
 * <p>
 * 提供年度结息、强制冻结/解冻、强制销户、账户详情查询功能。
 */
@Slf4j
@Service
public class AdminServiceImpl implements AdminService {

    private final DaoRegistry dao;

    public AdminServiceImpl(DaoRegistry dao) {
        this.dao = dao;
    }

    /**
     * 验证管理员权限——检查 staff 存在且权限等级 >= 9。
     */
    private DomainModels.Staff verifyAdmin(String adminId, String adminToken) {
        int staffId;
        try {
            staffId = Integer.parseInt(adminId);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.ERR_009, "管理员 ID 格式无效: " + adminId);
        }

        var staff = dao.staffDao().findById(staffId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_009, "管理员不存在: " + adminId));

        if (staff.permissionLevel() < 9) {
            throw new BusinessException(ErrorCode.ERR_009, "权限不足，需要管理员权限");
        }

        // 简单 token 校验（实际项目中应使用 JWT 等机制）
        if (adminToken == null || adminToken.isBlank()) {
            throw new BusinessException(ErrorCode.ERR_009, "管理员认证令牌不能为空");
        }

        return staff;
    }

    @Override
    public Map<String, Object> settleAnnualInterest(SettleAnnualInterestRequest request) {
        // 验证管理员
        int staffId;
        try {
            staffId = Integer.parseInt(request.getOperatorId());
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.ERR_009, "操作员 ID 格式无效");
        }
        var staff = dao.staffDao().findById(staffId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_009, "操作员不存在"));
        if (staff.permissionLevel() < 9) {
            throw new BusinessException(ErrorCode.ERR_009, "权限不足");
        }

        BigDecimal rate = request.getYearRate();
        LocalDate today = LocalDate.now();

        // 查找所有需要结息的账户
        var eligibleAccounts = dao.fundAccountDao().findEligibleForInterestPosting(today);

        int totalCount = 0;
        BigDecimal totalInterest = BigDecimal.ZERO;

        // 逐账户结息
        for (var account : eligibleAccounts) {
            try {
                BigDecimal result = dao.transactionManager().execute(connection -> {
                    var locked = dao.fundAccountDao().findByAccountNoForUpdate(connection, account.fundAccNo())
                            .orElse(null);
                    if (locked == null) {
                        return BigDecimal.ZERO;
                    }

                    // 使用账户自有利率或请求利率
                    BigDecimal effectiveRate = rate != null ? rate : locked.annualInterestRate();
                    if (effectiveRate == null || effectiveRate.compareTo(BigDecimal.ZERO) <= 0) {
                        effectiveRate = new BigDecimal("0.0035"); // 默认 0.35%
                    }

                    // 计算结息天数
                    LocalDate lastDate = locked.lastInterestDate() != null
                            ? locked.lastInterestDate()
                            : locked.openDate();
                    long days = ChronoUnit.DAYS.between(lastDate, today);
                    if (days <= 0) {
                        return BigDecimal.ZERO;
                    }

                    // 利息 = 可用余额 × 年利率 × 天数 / 365
                    BigDecimal interest = locked.availableBalance()
                            .multiply(effectiveRate)
                            .multiply(BigDecimal.valueOf(days))
                            .divide(BigDecimal.valueOf(365), 2, RoundingMode.HALF_UP);

                    if (interest.compareTo(BigDecimal.ZERO) <= 0) {
                        return BigDecimal.ZERO;
                    }

                    BigDecimal newAvailable = locked.availableBalance().add(interest);

                    // 更新余额和结息日期
                    dao.fundAccountDao().updateInterestPosting(connection, account.fundAccNo(),
                            newAvailable, today);

                    // 创建流水
                    dao.fundTransactionLogDao().create(connection, new DomainModels.FundTransactionLog(
                            null, account.fundAccNo(), DomainEnums.FundTransactionType.INTEREST,
                            interest, newAvailable, locked.frozenBalance(),
                            null, staffId, LocalDateTime.now()
                    ));

                    return interest;
                });
                if (result.compareTo(BigDecimal.ZERO) > 0) {
                    totalCount++;
                    totalInterest = totalInterest.add(result);
                }
            } catch (Exception e) {
                log.error("[settleAnnualInterest] 账户 {} 结息失败: {}", account.fundAccNo(), e.getMessage());
            }
        }

        log.info("[settleAnnualInterest] 完成: total_accounts={} total_interest={}", totalCount, totalInterest);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total_accounts", totalCount);
        result.put("total_interest", totalInterest);
        return result;
    }

    @Override
    public void adminFreezeAccount(AdminFreezeRequest request) {
        var admin = verifyAdmin(request.getAdminId(), request.getAdminToken());

        DomainEnums.AccountType accountType = EnumMapper.toDaoAccountType(request.getAccountType());
        DomainEnums.FreezeType freezeType = EnumMapper.toDaoFreezeType(request.getFreezeType());
        String accountNo = request.getAccountNo();

        dao.transactionManager().execute(connection -> {
            DomainEnums.AccountStatus currentStatus;
            BigDecimal frozenAmount = null;

            if (accountType == DomainEnums.AccountType.FUND) {
                var fundAccount = dao.fundAccountDao().findByAccountNoForUpdate(connection, accountNo)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + accountNo));
                currentStatus = fundAccount.status();

                // 检查是否已经同类型冻结 (ERR_011)
                var activeFreezes = dao.freezeRecordDao().findActiveRecords(accountType, accountNo);
                boolean alreadyFrozen = activeFreezes.stream()
                        .anyMatch(f -> f.freezeType() == freezeType);
                if (alreadyFrozen) {
                    throw new BusinessException(ErrorCode.ERR_011, "账户已是该冻结类型");
                }

                // 更新状态
                DomainEnums.AccountStatus newStatus = switch (freezeType) {
                    case LOSS -> DomainEnums.AccountStatus.LOSS_FROZEN;
                    case VIOLATION -> DomainEnums.AccountStatus.VIOLATION_FROZEN;
                    default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "不支持的冻结类型");
                };
                dao.fundAccountDao().updateStatus(connection, accountNo, newStatus);
                frozenAmount = fundAccount.availableBalance().add(fundAccount.frozenBalance());

            } else {
                var secAccount = dao.securityAccountDao().findByAccountNoForUpdate(connection, accountNo)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + accountNo));
                currentStatus = secAccount.status();

                var activeFreezes = dao.freezeRecordDao().findActiveRecords(accountType, accountNo);
                boolean alreadyFrozen = activeFreezes.stream()
                        .anyMatch(f -> f.freezeType() == freezeType);
                if (alreadyFrozen) {
                    throw new BusinessException(ErrorCode.ERR_011, "账户已是该冻结类型");
                }

                DomainEnums.AccountStatus newStatus = switch (freezeType) {
                    case LOSS -> DomainEnums.AccountStatus.LOSS_FROZEN;
                    case VIOLATION -> DomainEnums.AccountStatus.VIOLATION_FROZEN;
                    default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "不支持的冻结类型");
                };
                dao.securityAccountDao().updateStatus(connection, accountNo, newStatus);
            }

            // 创建冻结记录
            dao.freezeRecordDao().create(connection, new DomainModels.FreezeRecord(
                    null, accountType, accountNo, freezeType,
                    Optional.ofNullable(request.getReason()).orElse("管理员强制冻结"),
                    frozenAmount, null,
                    admin.staffId(), LocalDateTime.now(), null, true
            ));

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, admin.staffId(), "冻结账户", accountType.dbValue(),
                    accountNo, "管理员冻结，类型: " + freezeType.dbValue()
                    + "，原因: " + Optional.ofNullable(request.getReason()).orElse(""), LocalDateTime.now()
            ));

            log.info("[adminFreezeAccount] accountType={} accountNo={} freezeType={} adminId={}",
                    accountType.dbValue(), accountNo, freezeType.dbValue(), request.getAdminId());
            return null;
        });
    }

    @Override
    public void adminUnfreezeAccount(AdminFreezeRequest request) {
        var admin = verifyAdmin(request.getAdminId(), request.getAdminToken());

        DomainEnums.AccountType accountType = EnumMapper.toDaoAccountType(request.getAccountType());
        DomainEnums.FreezeType freezeType = EnumMapper.toDaoFreezeType(request.getFreezeType());
        String accountNo = request.getAccountNo();

        // 挂失冻结只能通过补办流程解冻，管理员不能解冻挂失 (ERR_009)
        if (freezeType == DomainEnums.FreezeType.LOSS) {
            throw new BusinessException(ErrorCode.ERR_009, "挂失冻结不支持管理员解冻，请通过补办流程");
        }

        dao.transactionManager().execute(connection -> {
            if (accountType == DomainEnums.AccountType.FUND) {
                var fundAccount = dao.fundAccountDao().findByAccountNoForUpdate(connection, accountNo)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ERR_010, "资金账户不存在: " + accountNo));

                // 检查是否处于该冻结状态
                if (fundAccount.status() != DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                    throw new BusinessException(ErrorCode.ERR_011, "账户未处于违规冻结状态");
                }

                // 检查是否有其他活跃冻结
                var activeFreezes = dao.freezeRecordDao().findActiveRecords(accountType, accountNo);
                boolean hasViolationFreeze = activeFreezes.stream()
                        .anyMatch(f -> f.freezeType() == DomainEnums.FreezeType.VIOLATION);
                if (!hasViolationFreeze) {
                    throw new BusinessException(ErrorCode.ERR_011, "未找到违规冻结记录");
                }

                // 关闭冻结记录后，检查是否还有其他活跃冻结
                dao.freezeRecordDao().closeActiveRecord(connection, accountType, accountNo,
                        DomainEnums.FreezeType.VIOLATION, LocalDateTime.now());

                var remainingFreezes = dao.freezeRecordDao().findActiveRecords(accountType, accountNo);
                if (remainingFreezes.isEmpty()) {
                    dao.fundAccountDao().updateStatus(connection, accountNo, DomainEnums.AccountStatus.NORMAL);
                }

            } else {
                var secAccount = dao.securityAccountDao().findByAccountNoForUpdate(connection, accountNo)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + accountNo));

                if (secAccount.status() != DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                    throw new BusinessException(ErrorCode.ERR_011, "账户未处于违规冻结状态");
                }

                dao.freezeRecordDao().closeActiveRecord(connection, accountType, accountNo,
                        DomainEnums.FreezeType.VIOLATION, LocalDateTime.now());

                var remainingFreezes = dao.freezeRecordDao().findActiveRecords(accountType, accountNo);
                if (remainingFreezes.isEmpty()) {
                    dao.securityAccountDao().updateStatus(connection, accountNo, DomainEnums.AccountStatus.NORMAL);
                }
            }

            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, admin.staffId(), "解冻账户", accountType.dbValue(),
                    accountNo, "管理员解冻，类型: " + freezeType.dbValue(), LocalDateTime.now()
            ));

            log.info("[adminUnfreezeAccount] accountType={} accountNo={} freezeType={}",
                    accountType.dbValue(), accountNo, freezeType.dbValue());
            return null;
        });
    }

    @Override
    public Map<String, Object> adminGetAccountDetails(String accountNo, String adminId, String adminToken) {
        verifyAdmin(adminId, adminToken);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountNo", accountNo);

        // 尝试查找资金账户
        var fundAccount = dao.fundAccountDao().findByAccountNo(accountNo);
        if (fundAccount.isPresent()) {
            var fa = fundAccount.get();
            result.put("type", "FUND");
            result.put("fund_acc_no", fa.fundAccNo());
            result.put("sec_acc_no", fa.secAccNo());
            result.put("available_balance", fa.availableBalance());
            result.put("frozen_balance", fa.frozenBalance());
            result.put("currency", fa.currency());
            result.put("status", EnumMapper.fromDaoStatus(fa.status()).cn());
            result.put("open_date", fa.openDate());

            // 查询关联的投资者信息
            if (fa.secAccNo() != null) {
                var secAccount = dao.securityAccountDao().findByAccountNo(fa.secAccNo());
                if (secAccount.isPresent()) {
                    var investor = dao.investorDao().findById(secAccount.get().investorId());
                    investor.ifPresent(inv -> {
                        result.put("investor_id", inv.investorId());
                        result.put("investor_name", inv.name());
                        result.put("id_number", inv.idNumber());
                        result.put("investor_type", com.zju.account.service.util.EnumMapper.fromDaoInvestorType(inv.type()));
                    });
                }
            }
            return result;
        }

        // 尝试查找证券账户
        var secAccount = dao.securityAccountDao().findByAccountNo(accountNo);
        if (secAccount.isPresent()) {
            var sa = secAccount.get();
            result.put("type", "SECURITY");
            result.put("sec_acc_no", sa.secAccNo());
            result.put("status", EnumMapper.fromDaoStatus(sa.status()).cn());
            result.put("open_date", sa.openDate());
            result.put("linked_fund_acc", sa.linkedFundAcc());

            var investor = dao.investorDao().findById(sa.investorId());
            investor.ifPresent(inv -> {
                result.put("investor_id", inv.investorId());
                result.put("investor_name", inv.name());
                result.put("id_number", inv.idNumber());
                result.put("investor_type", com.zju.account.service.util.EnumMapper.fromDaoInvestorType(inv.type()));
            });

            // 查询持仓
            var holdings = dao.holdingDao().listBySecurityAccountNo(accountNo);
            result.put("holdings_count", holdings.size());
            result.put("total_holdings_qty", holdings.stream().mapToInt(DomainModels.Holding::quantity).sum());

            return result;
        }

        throw new BusinessException(ErrorCode.ERR_010, "账户不存在: " + accountNo);
    }

    @Override
    public void adminCloseSecurityAccount(AdminCloseSecurityAccountRequest request) {
        var admin = verifyAdmin(request.getAdminId(), request.getAdminToken());
        String secAccNo = request.getSecurityAccountNo();

        dao.transactionManager().execute(connection -> {
            var account = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            if (account.status() == DomainEnums.AccountStatus.CLOSED) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已销户");
            }

            // 检查关联资金账户余额
            if (account.linkedFundAcc() != null && !account.linkedFundAcc().isBlank()) {
                var fundAccount = dao.fundAccountDao().findByAccountNo(account.linkedFundAcc());
                if (fundAccount.isPresent()) {
                    var fa = fundAccount.get();
                    if (fa.availableBalance().compareTo(BigDecimal.ZERO) > 0
                            || fa.frozenBalance().compareTo(BigDecimal.ZERO) > 0) {
                        throw new BusinessException(ErrorCode.ERR_007,
                                "关联资金账户尚有余额或冻结资金，请先清空资金账户");
                    }
                    if (fa.status() == DomainEnums.AccountStatus.LOSS_FROZEN
                            || fa.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                        throw new BusinessException(ErrorCode.ERR_017,
                                "关联资金账户处于冻结状态，请先解冻资金账户");
                    }
                }
            }

            // 强制销户
            dao.securityAccountDao().updateStatus(connection, secAccNo, DomainEnums.AccountStatus.CLOSED);

            // 解除关联
            if (account.linkedFundAcc() != null && !account.linkedFundAcc().isBlank()) {
                dao.securityAccountDao().unbindFundAccount(connection, secAccNo);
            }

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, admin.staffId(), "强制销户", "SECURITY",
                    secAccNo, "管理员强制销户，原因: " + request.getForceReason(), LocalDateTime.now()
            ));

            log.info("[adminCloseSecurityAccount] sec_acc_no={} force_reason={}",
                    secAccNo, request.getForceReason());
            return null;
        });
    }
}
