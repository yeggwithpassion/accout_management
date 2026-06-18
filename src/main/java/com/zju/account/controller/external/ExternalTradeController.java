package com.zju.account.controller.external;

import com.zju.account.common.Result;
import com.zju.account.dto.request.UpdateFundBalanceRequest;
import com.zju.account.dto.request.UpdateSecurityHoldingRequest;
import com.zju.account.service.FundAccountService;
import com.zju.account.service.SecurityAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 中央交易系统 ↔ 账户管理子系统 的对外接口。
 *
 * 严格对齐《对外部子系统接口说明》§4：
 *  - updateFundBalance     —— 资金账户余额变更
 *  - updateSecurityHolding —�� 证券账户持仓变更
 *
 * 字段命名全部为 snake_case。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/external/trade")
@RequiredArgsConstructor
public class ExternalTradeController {

    private final FundAccountService fundAccountService;
    private final SecurityAccountService securityAccountService;

    /**
     * §4.1 updateFundBalance — 买入冻结 / 买入扣款 / 卖出回款 / 撤单解冻。
     * 必须基于 ref_order_id 做幂等控制，成功后写入资金流水。
     */
    @PostMapping("/fund-balance")
    public Result<Void> updateFundBalance(@Valid @RequestBody UpdateFundBalanceRequest request) {
        log.info("[updateFundBalance] fund_acc_no={} ref_order_id={} txn_type={} amount={}",
                request.getFundAccNo(), request.getRefOrderId(),
                request.getTxnType(), request.getAmount());
        try {
            Object data = fundAccountService.updateFundBalance(request);
            return wrap(data, "资金变更成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[updateFundBalance] Service 未就绪，返回 Mock 数据");
            BigDecimal available = new BigDecimal("8800.00");
            BigDecimal frozen = new BigDecimal("1200.00");
            switch (request.getTxnType()) {
                case "买入冻结" -> {
                    available = available.subtract(request.getAmount());
                    frozen = frozen.add(request.getAmount());
                }
                case "买入扣款" -> frozen = frozen.subtract(request.getAmount());
                case "卖出回款" -> available = available.add(request.getAmount());
                case "撤单解冻" -> {
                    frozen = frozen.subtract(request.getAmount());
                    available = available.add(request.getAmount());
                }
                default -> {
                    // 已由 @Pattern 校验
                }
            }
            return Result.<Void>success("资金变更成功")
                    .put("available_balance", available)
                    .put("frozen_balance", frozen)
                    .put("log_id", ThreadLocalRandom.current().nextLong(100000, 999999));
        }
    }

    /**
     * §4.2 updateSecurityHolding — 买入增加 / 卖出冻结 / 卖出扣减 / 撤单释放。
     */
    @PostMapping("/security-holding")
    public Result<Void> updateSecurityHolding(@Valid @RequestBody UpdateSecurityHoldingRequest request) {
        log.info("[updateSecurityHolding] sec_acc_no={} stock_code={} change_type={} quantity={} price={}",
                request.getSecAccNo(), request.getStockCode(),
                request.getChangeType(), request.getQuantity(), request.getPrice());
        try {
            Object data = securityAccountService.updateSecurityHolding(request);
            return wrap(data, "持仓更新成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[updateSecurityHolding] Service 未就绪，返回 Mock 数据");
            int quantity = 1000;
            int frozen = 100;
            BigDecimal avgCost = new BigDecimal("10.2350");
            switch (request.getChangeType()) {
                case "买入增加" -> {
                    int newQty = quantity + request.getQuantity();
                    if (request.getPrice() != null) {
                        BigDecimal totalCost = avgCost.multiply(BigDecimal.valueOf(quantity))
                                .add(request.getPrice().multiply(BigDecimal.valueOf(request.getQuantity())));
                        avgCost = totalCost.divide(BigDecimal.valueOf(newQty), 4, java.math.RoundingMode.HALF_UP);
                    }
                    quantity = newQty;
                }
                case "卖出冻结" -> frozen += request.getQuantity();
                case "卖出扣减" -> {
                    quantity -= request.getQuantity();
                    frozen -= request.getQuantity();
                }
                case "撤单释放" -> frozen -= request.getQuantity();
                default -> { /* @Pattern 校验 */ }
            }
            return Result.<Void>success("持仓更新成功")
                    .put("quantity", quantity)
                    .put("frozen_quantity", frozen)
                    .put("avg_cost", avgCost);
        }
    }

    @SuppressWarnings("unchecked")
    private Result<Void> wrap(Object data, String defaultMsg) {
        if (data instanceof java.util.Map<?, ?> m) {
            Result<Void> r = Result.success(defaultMsg);
            ((java.util.Map<String, Object>) m).forEach(r::put);
            return r;
        }
        return Result.success(defaultMsg);
    }
}
