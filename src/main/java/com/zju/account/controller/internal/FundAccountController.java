package com.zju.account.controller.internal;

import com.zju.account.common.Result;
import com.zju.account.dto.request.*;
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
import java.util.concurrent.ThreadLocalRandom;

/**
 * 内部 / 工作人员资金账户管理接口。
 * 严格对齐《数据库具体设计与对外接口说明》§7.3，字段使用 snake_case。
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/internal/fund")
@RequiredArgsConstructor
public class FundAccountController {

    private final FundAccountService fundAccountService;

    /** §7.3.1 createFundAccount —— 开设资金账户并绑定证券账户 */
    @PostMapping("/accounts")
    public Result<Void> createFundAccount(@Valid @RequestBody CreateFundAccountRequest request) {
        log.info("[createFundAccount] sec_acc_no={} id_number={} currency={} staff_id={}",
                request.getSecAccNo(), request.getIdNumber(),
                request.getCurrency(), request.getStaffId());
        try {
            return wrap(fundAccountService.createFundAccount(request), "开户成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service���完善后替换
            log.warn("[createFundAccount] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("开户成功")
                    .put("fund_acc_no", "F" + System.currentTimeMillis())
                    .put("status", "正常");
        }
    }

    /** §7.3.2 deposit —— 存款 */
    @PostMapping("/deposit")
    public Result<Void> deposit(@Valid @RequestBody DepositRequest request) {
        log.info("[deposit] fund_acc_no={} amount={} staff_id={}",
                request.getFundAccNo(), request.getAmount(), request.getStaffId());
        try {
            return wrap(fundAccountService.deposit(request), "存款成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[deposit] Service 未就绪，返回 Mock 数据");
            BigDecimal newBalance = new BigDecimal("10000.00").add(request.getAmount());
            return Result.<Void>success("存款成功")
                    .put("available_balance", newBalance)
                    .put("log_id", ThreadLocalRandom.current().nextLong(100000, 999999));
        }
    }

    /** §7.3.3 withdraw —— 取款 */
    @PostMapping("/withdraw")
    public Result<Void> withdraw(@Valid @RequestBody WithdrawRequest request) {
        log.info("[withdraw] fund_acc_no={} amount={} staff_id={}",
                request.getFundAccNo(), request.getAmount(), request.getStaffId());
        try {
            return wrap(fundAccountService.withdraw(request), "取款成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[withdraw] Service 未就绪，返回 Mock 数据");
            BigDecimal newBalance = new BigDecimal("10000.00").subtract(request.getAmount());
            return Result.<Void>success("取款成功")
                    .put("available_balance", newBalance)
                    .put("log_id", ThreadLocalRandom.current().nextLong(100000, 999999));
        }
    }

    /** §7.3.4 changeFundPassword —— 工作人员代客修改密码 */
    @PutMapping("/password")
    public Result<Void> changeFundPassword(@Valid @RequestBody ChangeFundPasswordRequest request) {
        log.info("[changeFundPassword] fund_acc_no={} password_type={} staff_id={}",
                request.getFundAccNo(), request.getPasswordType(), request.getStaffId());
        try {
            fundAccountService.changeFundPassword(request);
            return Result.success("密码修改成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[changeFundPassword] Service 未就绪，返回 Mock 数据");
            return Result.success("密码修改成功");
        }
    }

    /** §7.3.5 reportFundLoss —— 资金账户挂失 */
    @PostMapping("/accounts/loss")
    public Result<Void> reportFundLoss(@Valid @RequestBody ReportFundLossRequest request) {
        log.info("[reportFundLoss] fund_acc_no={} staff_id={} reason={}",
                request.getFundAccNo(), request.getStaffId(), request.getReason());
        try {
            return wrap(fundAccountService.reportFundLoss(request), "挂失成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[reportFundLoss] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("挂失成功").put("status", "挂失冻结");
        }
    }

    /** §7.3.6 reissueFundAccount —— 补办资金账户 */
    @PostMapping("/accounts/reissue")
    public Result<Void> reissueFundAccount(@Valid @RequestBody ReissueFundAccountRequest request) {
        log.info("[reissueFundAccount] old_fund_acc_no={} staff_id={}",
                request.getOldFundAccNo(), request.getStaffId());
        try {
            return wrap(fundAccountService.reissueFundAccount(request), "补办成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[reissueFundAccount] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("补办成功")
                    .put("new_fund_acc_no", "F" + System.currentTimeMillis());
        }
    }

    /** §7.3.7 closeFundAccount —— 销户资金账户 */
    @PostMapping("/accounts/close")
    public Result<Void> closeFundAccount(@Valid @RequestBody CloseFundAccountRequest request) {
        log.info("[closeFundAccount] fund_acc_no={} staff_id={} reason={}",
                request.getFundAccNo(), request.getStaffId(), request.getReason());
        try {
            return wrap(fundAccountService.closeFundAccount(request), "销户成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[closeFundAccount] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("销户成功").put("status", "已销户");
        }
    }

    /** §7.3.8 queryFundInfo —— 查询资金账户基本信息及流水 */
    @GetMapping("/accounts")
    public Result<Void> queryFundInfo(
            @RequestParam("fund_acc_no") @NotBlank String fundAccNo,
            @RequestParam("id_number") @NotBlank String idNumber,
            @RequestParam(value = "include_logs", defaultValue = "false") boolean includeLogs) {
        log.info("[queryFundInfo] fund_acc_no={} include_logs={}", fundAccNo, includeLogs);
        try {
            return wrap(fundAccountService.queryFundInfo(fundAccNo, idNumber, includeLogs), "查询成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[queryFundInfo] Service 未就绪，返回 Mock 数据");
            Result<Void> r = Result.<Void>success("查询成功")
                    .put("available_balance", new BigDecimal("8800.00"))
                    .put("frozen_balance", new BigDecimal("1200.00"))
                    .put("currency", "CNY")
                    .put("status", "正常");
            if (includeLogs) {
                List<FundLogView> mockLogs = List.of(
                        FundLogView.builder().logId(20001L).txnType("存款")
                                .amount(new BigDecimal("10000.00"))
                                .txnTime(LocalDateTime.now().minusDays(2)).build(),
                        FundLogView.builder().logId(20002L).txnType("取款")
                                .amount(new BigDecimal("200.00"))
                                .txnTime(LocalDateTime.now().minusDays(1)).build()
                );
                r.put("logs", mockLogs);
            }
            return r;
        }
    }

    @SuppressWarnings("unchecked")
    private Result<Void> wrap(Object data, String defaultMsg) {
        if (data instanceof java.util.Map<?, ?> m) {
            Result<Void> r = Result.success(defaultMsg);
            ((java.util.Map<String, Object>) m).forEach((k, v) -> r.put(String.valueOf(k), v));
            return r;
        }
        return Result.success(defaultMsg);
    }
}
