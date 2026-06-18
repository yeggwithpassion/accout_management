package com.zju.account.controller.external;

import com.zju.account.common.Result;
import com.zju.account.dto.request.ClientChangeFundPasswordRequest;
import com.zju.account.dto.request.ClientLoginAuthRequest;
import com.zju.account.dto.response.FundLogView;
import com.zju.account.service.FundAccountService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 交易客户端 ↔ 资金账户业务 的对外接口。
 *
 * 严格对齐《对外部子系统接口说明》§3：
 *  - clientLoginAuth
 *  - getFundSnapshot
 *  - clientChangeFundPassword
 *
 * 字段命名全部为 snake_case（fund_acc_no / trade_password ...）。
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/external/fund")
@RequiredArgsConstructor
public class ExternalFundController {

    private final FundAccountService fundAccountService;

    /** §3.1 clientLoginAuth — 投资者通过资金账户号 + 交易密码登录交易客户端 */
    @PostMapping("/login")
    public Result<Void> clientLoginAuth(@Valid @RequestBody ClientLoginAuthRequest request) {
        log.info("[clientLoginAuth] fund_acc_no={}", request.getFundAccNo());
        try {
            Object data = fundAccountService.clientLoginAuth(request.getFundAccNo(), request.getTradePassword());
            return wrapLoginResult(data, request.getFundAccNo());
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[clientLoginAuth] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("登录成功")
                    .put("fund_acc_no", request.getFundAccNo())
                    .put("sec_acc_no", "S100000001")
                    .put("status", "NORMAL");
        }
    }

    /** §3.2 getFundSnapshot — 查询资金账户快照（余额展示 / 下单前查看） */
    @GetMapping("/snapshot")
    public Result<Void> getFundSnapshot(@RequestParam("fund_acc_no") @NotBlank String fundAccNo) {
        log.info("[getFundSnapshot] fund_acc_no={}", fundAccNo);
        try {
            Object data = fundAccountService.getFundSnapshot(fundAccNo);
            return wrapSnapshotResult(data);
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            List<FundLogView> mockLogs = List.of(
                    FundLogView.builder()
                            .logId(10001L).txnType("存款").amount(new BigDecimal("5000.00"))
                            .txnTime(LocalDateTime.now().minusDays(1)).build(),
                    FundLogView.builder()
                            .logId(10002L).txnType("买入冻结").amount(new BigDecimal("1200.50"))
                            .refOrderId("ORD202606180001")
                            .txnTime(LocalDateTime.now().minusHours(2)).build()
            );
            return Result.<Void>success("查询成功")
                    .put("available_balance", new BigDecimal("3799.50"))
                    .put("frozen_balance", new BigDecimal("1200.50"))
                    .put("currency", "CNY")
                    .put("status", "NORMAL")
                    .put("recent_logs", mockLogs);
        }
    }

    /** §3.4 clientChangeFundPassword — 投资者修改交易密码或取款密码 */
    @PutMapping("/password")
    public Result<Void> clientChangeFundPassword(@Valid @RequestBody ClientChangeFundPasswordRequest request) {
        log.info("[clientChangeFundPassword] fund_acc_no={} password_type={}",
                request.getFundAccNo(), request.getPasswordType());
        try {
            fundAccountService.clientChangeFundPassword(request);
            return Result.success("密码修改成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[clientChangeFundPassword] Service 未就绪，返回 Mock 数据");
            return Result.success("密码修改成功");
        }
    }

    /** 兼容 Service 已返回结构化对象时直接透传（当前 Mock 阶段未启用）。 */
    @SuppressWarnings("unchecked")
    private Result<Void> wrapLoginResult(Object data, String fundAccNo) {
        if (data instanceof java.util.Map<?, ?> m) {
            Result<Void> r = Result.success("登录成功");
            ((java.util.Map<String, Object>) m).forEach(r::put);
            return r;
        }
        return Result.<Void>success("登录成功").put("fund_acc_no", fundAccNo);
    }

    @SuppressWarnings("unchecked")
    private Result<Void> wrapSnapshotResult(Object data) {
        if (data instanceof java.util.Map<?, ?> m) {
            Result<Void> r = Result.success("查询成功");
            ((java.util.Map<String, Object>) m).forEach(r::put);
            return r;
        }
        return Result.success("查询成功");
    }
}
