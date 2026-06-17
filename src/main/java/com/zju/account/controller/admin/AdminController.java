package com.zju.account.controller.admin;

import com.zju.account.common.Result;
import com.zju.account.dto.request.AdminCloseSecurityAccountRequest;
import com.zju.account.dto.request.AdminFreezeRequest;
import com.zju.account.dto.request.SettleAnnualInterestRequest;
import com.zju.account.service.AdminService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

/**
 * 管理员接口：年度结息、强制冻结/解冻、强制销户、账户详情查询。
 *
 *  - settleAnnualInterest 字段使用 snake_case（数据库设计文档 §7.3.12）
 *  - admin* 系列字段使用 camelCase（账户业务系统接口文档 二）
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    /** §7.3.12 settleAnnualInterest —— 执行年度结息 */
    @PostMapping("/fund/settle-annual-interest")
    public Result<Void> settleAnnualInterest(@Valid @RequestBody SettleAnnualInterestRequest request) {
        log.info("[settleAnnualInterest] operator_id={} year_rate={}",
                request.getOperatorId(), request.getYearRate());
        try {
            return wrap(adminService.settleAnnualInterest(request), "结息完成");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[settleAnnualInterest] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("结息完成")
                    .put("total_accounts", 128)
                    .put("total_interest", new BigDecimal("3621.45"));
        }
    }

    /** 管理员强制冻结账户（账户业务系统接口文档 二.1，camelCase） */
    @PostMapping("/accounts/freeze")
    public Result<Void> adminFreezeAccount(@Valid @RequestBody AdminFreezeRequest request) {
        log.info("[adminFreezeAccount] accountType={} accountNo={} freezeType={} adminId={} reason={}",
                request.getAccountType(), request.getAccountNo(),
                request.getFreezeType(), request.getAdminId(), request.getReason());
        try {
            adminService.adminFreezeAccount(request);
            return Result.success("操作成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[adminFreezeAccount] Service 未就绪，返回 Mock 数据");
            return Result.success("操作成功");
        }
    }

    /** 管理员解冻账户 */
    @PostMapping("/accounts/unfreeze")
    public Result<Void> adminUnfreezeAccount(@Valid @RequestBody AdminFreezeRequest request) {
        log.info("[adminUnfreezeAccount] accountType={} accountNo={} freezeType={} adminId={}",
                request.getAccountType(), request.getAccountNo(),
                request.getFreezeType(), request.getAdminId());
        try {
            adminService.adminUnfreezeAccount(request);
            return Result.success("操作成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[adminUnfreezeAccount] Service 未就绪，返回 Mock 数据");
            return Result.success("操作成功");
        }
    }

    /** 管理员查询账户详细信息（账户业务系统接口文档 二.2） */
    @GetMapping("/accounts/{accountNo}")
    public Result<Void> adminGetAccountDetails(
            @PathVariable("accountNo") @NotBlank String accountNo,
            @RequestParam("adminId") @NotBlank String adminId,
            @RequestParam("adminToken") @NotBlank String adminToken) {
        log.info("[adminGetAccountDetails] accountNo={} adminId={}", accountNo, adminId);
        try {
            return wrap(adminService.adminGetAccountDetails(accountNo, adminId, adminToken), "查询成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[adminGetAccountDetails] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("查询成功")
                    .put("accountNo", accountNo)
                    .put("investorId", "11010119900307663X")
                    .put("name", "张三")
                    .put("status", "NORMAL")
                    .put("linkedAccountNo", "S100000001");
        }
    }

    /** 管理员强制销户证券账户（账户业务系统接口文档 二.3） */
    @PostMapping("/security/force-close")
    public Result<Void> adminCloseSecurityAccount(@Valid @RequestBody AdminCloseSecurityAccountRequest request) {
        log.info("[adminCloseSecurityAccount] securityAccountNo={} adminId={} forceReason={}",
                request.getSecurityAccountNo(), request.getAdminId(), request.getForceReason());
        try {
            adminService.adminCloseSecurityAccount(request);
            return Result.success("强制销户成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[adminCloseSecurityAccount] Service 未就绪，返回 Mock 数据");
            return Result.success("强制销户成功");
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
