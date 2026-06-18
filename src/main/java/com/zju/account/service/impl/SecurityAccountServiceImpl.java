package com.zju.account.service.impl;

import account.dao.DaoRegistry;
import account.dao.model.DomainEnums;
import account.dao.model.DomainModels;
import com.zju.account.common.BusinessException;
import com.zju.account.common.ErrorCode;
import com.zju.account.dto.request.*;
import com.zju.account.dto.response.HoldingView;
import com.zju.account.enums.AccountStatus;
import com.zju.account.service.SecurityAccountService;
import com.zju.account.service.util.AccountNumberGenerator;
import com.zju.account.service.util.EnumMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 证券账户业务 Service 实现。
 * <p>
 * 覆盖 SecurityAccountService 接口中的所有方法，
 * 严格对齐 README 中的外部/内部接口规范与错误码表。
 */
@Slf4j
@Service
public class SecurityAccountServiceImpl implements SecurityAccountService {

    private final DaoRegistry dao;

    public SecurityAccountServiceImpl(DaoRegistry dao) {
        this.dao = dao;
    }

    // ==================== 内部接口 ====================

    @Override
    public Map<String, Object> createSecurityAccount(CreateSecurityAccountRequest request) {
        String idNumber = request.getIdNumber();
        String investorTypeCn = request.getInvestorType();

        // 1. 检查黑名单
        if (dao.blacklistDao().isBlocked(idNumber)) {
            throw new BusinessException(ErrorCode.ERR_012, "投资者在黑名单中，无法开立证券账户");
        }

        return dao.transactionManager().execute(connection -> {
            // 2. 查找或创建投资者
            int investorId;
            var existingInvestor = dao.investorDao().findByIdNumber(idNumber);
            if (existingInvestor.isPresent()) {
                investorId = existingInvestor.get().investorId();

                // 检查是否已拥有非销户状态的证券账户（ERR_006）
                var latestAccount = dao.securityAccountDao().findLatestNonClosedByInvestorId(investorId);
                if (latestAccount.isPresent()) {
                    throw new BusinessException(ErrorCode.ERR_006,
                            "该投资者已拥有证券账户: " + latestAccount.get().secAccNo());
                }
            } else {
                // 创建新投资者
                DomainEnums.InvestorType daoInvestorType =
                        com.zju.account.service.util.EnumMapper.toDaoInvestorType(investorTypeCn);

                var investor = new DomainModels.Investor(
                        null, daoInvestorType, request.getName(),
                        request.getIdType(), idNumber, request.getPhone(),
                        request.getAddress(), request.getOccupation(), request.getEducation(),
                        request.getLegalNumber(), request.getBusinessLicense(),
                        request.getAuthorizeName(), request.getAuthorizePhone(), request.getAuthorizeAddress(),
                        request.getExecutorName(), request.getAgentName(), request.getAgentIdNumber(),
                        LocalDateTime.now()
                );
                investorId = dao.investorDao().create(connection, investor);
            }

            // 3. 生成证券账户号并创建
            String secAccNo = AccountNumberGenerator.generateSecurityAccountNo();
            var secAccount = new DomainModels.SecurityAccount(
                    secAccNo, investorId, DomainEnums.AccountStatus.NORMAL,
                    LocalDate.now(), null
            );
            dao.securityAccountDao().create(connection, secAccount);

            // 4. 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "证券开户", "SECURITY",
                    secAccNo, investorTypeCn + "投资者开户，姓名: " + request.getName(), LocalDateTime.now()
            ));

            log.info("[createSecurityAccount] sec_acc_no={} investor_id={} name={}",
                    secAccNo, investorId, request.getName());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sec_acc_no", secAccNo);
            result.put("status", AccountStatus.NORMAL.cn());
            result.put("investor_id", investorId);
            return result;
        });
    }

    @Override
    public Map<String, Object> reportSecurityLoss(ReportSecurityLossRequest request) {
        String secAccNo = request.getSecAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var account = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            // 验证身份
            verifyInvestorOwnership(account.investorId(), idNumber);

            // 检查状态
            if (account.status() == DomainEnums.AccountStatus.LOSS_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已是挂失冻结状态");
            }
            if (account.status() == DomainEnums.AccountStatus.CLOSED) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已销户");
            }

            // 冻结
            dao.securityAccountDao().updateStatus(connection, secAccNo, DomainEnums.AccountStatus.LOSS_FROZEN);

            // 冻结记录
            dao.freezeRecordDao().create(connection, new DomainModels.FreezeRecord(
                    null, DomainEnums.AccountType.SECURITY, secAccNo,
                    DomainEnums.FreezeType.LOSS,
                    Optional.ofNullable(request.getReason()).orElse("挂失"),
                    null, null,
                    request.getStaffId(), LocalDateTime.now(), null, true
            ));

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "挂失", "SECURITY",
                    secAccNo, "证券账户挂失，原因: " + Optional.ofNullable(request.getReason()).orElse(""), LocalDateTime.now()
            ));

            log.info("[reportSecurityLoss] sec_acc_no={}", secAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", AccountStatus.FROZEN_LOSS.cn());
            return result;
        });
    }

    @Override
    public Map<String, Object> reissueSecurityAccount(ReissueSecurityAccountRequest request) {
        String oldSecAccNo = request.getOldSecAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var oldAccount = dao.securityAccountDao().findByAccountNoForUpdate(connection, oldSecAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + oldSecAccNo));

            // 验证身份
            verifyInvestorOwnership(oldAccount.investorId(), idNumber);

            // 必须处于挂失冻结状态
            if (oldAccount.status() != DomainEnums.AccountStatus.LOSS_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_011, "证券账户未处于挂失冻结状态，无法补办");
            }

            // 生成新账户号
            String newSecAccNo = AccountNumberGenerator.generateSecurityAccountNo();

            // 创建新证券账户
            var newAccount = new DomainModels.SecurityAccount(
                    newSecAccNo, oldAccount.investorId(),
                    DomainEnums.AccountStatus.NORMAL, LocalDate.now(),
                    oldAccount.linkedFundAcc()
            );
            dao.securityAccountDao().create(connection, newAccount);

            // 迁移持仓到新账户
            var holdings = dao.holdingDao().listBySecurityAccountNo(oldSecAccNo);
            for (var holding : holdings) {
                dao.holdingDao().saveOrUpdate(connection, new DomainModels.Holding(
                        null, newSecAccNo, holding.stockCode(),
                        holding.quantity(), holding.frozenQuantity(),
                        holding.avgCost(), LocalDateTime.now()
                ));
            }

            // 更新关联的资金账户绑定
            if (oldAccount.linkedFundAcc() != null && !oldAccount.linkedFundAcc().isBlank()) {
                dao.fundAccountDao().relinkSecurityAccount(connection,
                        oldAccount.linkedFundAcc(), newSecAccNo);
            }

            // 关闭旧账户
            dao.securityAccountDao().updateStatus(connection, oldSecAccNo, DomainEnums.AccountStatus.CLOSED);

            // 释放挂失冻结
            dao.freezeRecordDao().closeActiveRecord(connection,
                    DomainEnums.AccountType.SECURITY, oldSecAccNo,
                    DomainEnums.FreezeType.LOSS, LocalDateTime.now());

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "补办", "SECURITY",
                    newSecAccNo, "补办证券账户，旧账户: " + oldSecAccNo, LocalDateTime.now()
            ));

            log.info("[reissueSecurityAccount] old={} new={}", oldSecAccNo, newSecAccNo);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("new_sec_acc_no", newSecAccNo);
            result.put("old_sec_acc_no", oldSecAccNo);
            return result;
        });
    }

    @Override
    public Map<String, Object> closeSecurityAccount(CloseSecurityAccountRequest request) {
        String secAccNo = request.getSecAccNo();
        String idNumber = request.getIdNumber();

        return dao.transactionManager().execute(connection -> {
            var account = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            // 验证身份
            verifyInvestorOwnership(account.investorId(), idNumber);

            // 检查状态
            if (account.status() == DomainEnums.AccountStatus.CLOSED) {
                throw new BusinessException(ErrorCode.ERR_011, "账户已销户");
            }
            if (account.status() == DomainEnums.AccountStatus.LOSS_FROZEN
                    || account.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_003, "账户处于冻结状态，无法销户");
            }

            // 检查持仓
            int totalQuantity = dao.holdingDao().sumQuantityBySecurityAccountNo(secAccNo);
            DomainEnums.AccountStatus newStatus;
            if (totalQuantity > 0) {
                // 有持仓 → 预销户
                newStatus = DomainEnums.AccountStatus.PRE_CLOSE;
            } else {
                newStatus = DomainEnums.AccountStatus.CLOSED;
            }

            // 检查关联的资金账户
            if (account.linkedFundAcc() != null && !account.linkedFundAcc().isBlank()) {
                var fundAccount = dao.fundAccountDao().findByAccountNo(account.linkedFundAcc());
                if (fundAccount.isPresent()
                        && fundAccount.get().status() != DomainEnums.AccountStatus.CLOSED
                        && totalQuantity == 0) {
                    // 如果有关联的活跃资金账户且无持仓，解除绑定
                    dao.securityAccountDao().unbindFundAccount(connection, secAccNo);
                }
            }

            dao.securityAccountDao().updateStatus(connection, secAccNo, newStatus);

            // 操作日志
            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null, request.getStaffId(), "销户", "SECURITY",
                    secAccNo, "证券账户销户，原因: " + Optional.ofNullable(request.getReason()).orElse("")
                    + "，状态: " + newStatus.dbValue(), LocalDateTime.now()
            ));

            log.info("[closeSecurityAccount] sec_acc_no={} total_quantity={} new_status={}",
                    secAccNo, totalQuantity, newStatus.dbValue());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", EnumMapper.fromDaoStatus(newStatus).cn());
            return result;
        });
    }

    // ==================== 外部接口 ====================

    @Override
    public Map<String, Object> getSecuritySnapshot(String secAccNo, String stockCode) {
        var account = dao.securityAccountDao().findByAccountNo(secAccNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在"));

        // 检查状态
        DomainEnums.AccountStatus daoStatus = account.status();
        if (daoStatus == DomainEnums.AccountStatus.LOSS_FROZEN
                || daoStatus == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
            throw new BusinessException(ErrorCode.ERR_003, "账户已冻结");
        }
        if (daoStatus == DomainEnums.AccountStatus.CLOSED) {
            throw new BusinessException(ErrorCode.ERR_010, "账户已销户");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sec_acc_no", secAccNo);

        if (stockCode != null && !stockCode.isBlank()) {
            // 单只股票查询
            var holding = dao.holdingDao().findByAccountAndStock(secAccNo, stockCode);
            if (holding.isPresent()) {
                var h = holding.get();
                result.put("stock_code", h.stockCode());
                result.put("quantity", h.quantity());
                result.put("frozen_quantity", h.frozenQuantity());
                result.put("available_quantity", h.availableQuantity());
                result.put("avg_cost", h.avgCost());
            } else {
                // 未持有该股票，返回零持仓
                result.put("stock_code", stockCode);
                result.put("quantity", 0);
                result.put("frozen_quantity", 0);
                result.put("available_quantity", 0);
                result.put("avg_cost", BigDecimal.ZERO);
            }
        } else {
            // 全部持仓
            var holdings = dao.holdingDao().listBySecurityAccountNo(secAccNo);
            List<HoldingView> holdingViews = holdings.stream()
                    .map(h -> HoldingView.builder()
                            .stockCode(h.stockCode())
                            .quantity(h.quantity())
                            .frozenQuantity(h.frozenQuantity())
                            .availableQuantity(h.availableQuantity())
                            .avgCost(h.avgCost())
                            .build())
                    .toList();
            result.put("holdings", holdingViews);
        }

        return result;
    }

    @Override
    public Map<String, Object> updateSecurityHolding(UpdateSecurityHoldingRequest request) {
        String secAccNo = request.getSecAccNo();
        String stockCode = request.getStockCode();
        String changeType = request.getChangeType();
        int quantity = request.getQuantity();
        BigDecimal price = request.getPrice();

        return dao.transactionManager().execute(connection -> {
            // 检查证券账户
            var account = dao.securityAccountDao().findByAccountNoForUpdate(connection, secAccNo)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_005, "证券账户不存在: " + secAccNo));

            DomainEnums.AccountStatus daoStatus = account.status();
            if (daoStatus == DomainEnums.AccountStatus.LOSS_FROZEN
                    || daoStatus == DomainEnums.AccountStatus.VIOLATION_FROZEN) {
                throw new BusinessException(ErrorCode.ERR_003, "账户已冻结");
            }
            if (daoStatus == DomainEnums.AccountStatus.CLOSED) {
                throw new BusinessException(ErrorCode.ERR_010, "账户已销户，无法变更持仓");
            }
            if (daoStatus == DomainEnums.AccountStatus.PRE_CLOSE) {
                throw new BusinessException(ErrorCode.ERR_010, "账户已预销户，无法变更持仓");
            }

            // 查找或初始化持仓
            var existingHolding = dao.holdingDao().findByAccountAndStockForUpdate(connection, secAccNo, stockCode);
            int currentQty = existingHolding.map(DomainModels.Holding::quantity).orElse(0);
            int currentFrozen = existingHolding.map(DomainModels.Holding::frozenQuantity).orElse(0);
            BigDecimal currentAvgCost = existingHolding.map(DomainModels.Holding::avgCost).orElse(BigDecimal.ZERO);

            int newQty = currentQty;
            int newFrozen = currentFrozen;
            BigDecimal newAvgCost = currentAvgCost;

            switch (changeType) {
                case "买入增加" -> {
                    // 计算新的移动平均成本
                    if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal totalCost = currentAvgCost.multiply(BigDecimal.valueOf(currentQty))
                                .add(price.multiply(BigDecimal.valueOf(quantity)));
                        newQty = currentQty + quantity;
                        if (newQty > 0) {
                            newAvgCost = totalCost.divide(BigDecimal.valueOf(newQty), 4, RoundingMode.HALF_UP);
                        }
                    } else {
                        newQty = currentQty + quantity;
                    }
                }
                case "卖出冻结" -> {
                    int available = currentQty - currentFrozen;
                    if (available < quantity) {
                        throw new BusinessException(ErrorCode.ERR_002,
                                "可卖数量不足: 需要 " + quantity + "，当前可卖 " + available);
                    }
                    newFrozen = currentFrozen + quantity;
                }
                case "卖出扣减" -> {
                    if (currentFrozen < quantity) {
                        throw new BusinessException(ErrorCode.ERR_002,
                                "冻结持仓不足: 需要扣减 " + quantity + "，当前冻结 " + currentFrozen);
                    }
                    newQty = currentQty - quantity;
                    newFrozen = currentFrozen - quantity;
                }
                case "撤单释放" -> {
                    if (currentFrozen < quantity) {
                        throw new BusinessException(ErrorCode.ERR_002,
                                "冻结持仓不足: 需要释放 " + quantity + "，当前冻结 " + currentFrozen);
                    }
                    newFrozen = currentFrozen - quantity;
                }
                default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "不支持的持仓变更类型: " + changeType);
            }

            // 保存持仓
            var updatedHolding = dao.holdingDao().saveOrUpdate(connection, new DomainModels.Holding(
                    existingHolding.map(DomainModels.Holding::holdingId).orElse(null),
                    secAccNo, stockCode, newQty, newFrozen, newAvgCost, LocalDateTime.now()
            ));

            log.info("[updateSecurityHolding] sec_acc_no={} stock={} change={} qty={} new_qty={} new_frozen={}",
                    secAccNo, stockCode, changeType, quantity, newQty, newFrozen);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("quantity", Math.max(0, newQty));
            result.put("frozen_quantity", Math.max(0, newFrozen));
            result.put("available_quantity", Math.max(0, newQty - newFrozen));
            result.put("avg_cost", newAvgCost);
            return result;
        });
    }

    // ==================== 辅助方法 ====================

    /**
     * 验证投资者身份证号。
     */
    private void verifyInvestorOwnership(int investorId, String idNumber) {
        var investor = dao.investorDao().findById(investorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_013, "投资者不存在"));
        if (!investor.idNumber().equals(idNumber)) {
            throw new BusinessException(ErrorCode.ERR_013, "身份证号与账户持有人不一致");
        }
    }
}
