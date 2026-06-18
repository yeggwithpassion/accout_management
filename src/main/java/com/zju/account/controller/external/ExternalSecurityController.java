package com.zju.account.controller.external;

import com.zju.account.common.Result;
import com.zju.account.dto.response.HoldingView;
import com.zju.account.service.SecurityAccountService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * 交易客户端 ↔ 证券账户业务 的对外接口。
 *
 * 严格对齐《对外部子系统接口说明》§3.3：
 *  - getSecuritySnapshot
 *
 * 字段命名全部为 snake_case。
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/external/security")
@RequiredArgsConstructor
public class ExternalSecurityController {

    private final SecurityAccountService securityAccountService;

    /**
     * §3.3 getSecuritySnapshot —— 查询证券账户持仓快照。
     * stock_code 不传时返回全部持仓；传入时返回该股票单条持仓。
     * 可卖数量 = quantity - frozen_quantity。
     */
    @GetMapping("/snapshot")
    public Result<Void> getSecuritySnapshot(
            @RequestParam("sec_acc_no") @NotBlank String secAccNo,
            @RequestParam(value = "stock_code", required = false) String stockCode) {
        log.info("[getSecuritySnapshot] sec_acc_no={} stock_code={}", secAccNo, stockCode);
        try {
            Object data = securityAccountService.getSecuritySnapshot(secAccNo, stockCode);
            return wrap(data);
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[getSecuritySnapshot] Service 未就绪，返回 Mock 数据");
            if (stockCode != null && !stockCode.isBlank()) {
                int quantity = 1000;
                int frozen = 200;
                return Result.<Void>success("查询成功")
                        .put("stock_code", stockCode)
                        .put("quantity", quantity)
                        .put("frozen_quantity", frozen)
                        .put("available_quantity", quantity - frozen)
                        .put("avg_cost", new BigDecimal("10.2350"));
            }
            List<HoldingView> mock = List.of(
                    HoldingView.builder().stockCode("000001").quantity(1000)
                            .frozenQuantity(0).availableQuantity(1000)
                            .avgCost(new BigDecimal("10.2350")).build(),
                    HoldingView.builder().stockCode("600519").quantity(50)
                            .frozenQuantity(10).availableQuantity(40)
                            .avgCost(new BigDecimal("1800.5000")).build()
            );
            return Result.<Void>success("查询成功").put("holdings", mock);
        }
    }

    @SuppressWarnings("unchecked")
    private Result<Void> wrap(Object data) {
        if (data instanceof java.util.Map<?, ?> m) {
            Result<Void> r = Result.success("查询成功");
            ((java.util.Map<String, Object>) m).forEach(r::put);
            return r;
        }
        return Result.success("查询成功");
    }
}
