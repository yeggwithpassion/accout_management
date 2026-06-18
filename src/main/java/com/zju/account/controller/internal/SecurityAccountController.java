package com.zju.account.controller.internal;

import com.zju.account.common.Result;
import com.zju.account.dto.request.CloseSecurityAccountRequest;
import com.zju.account.dto.request.CreateSecurityAccountRequest;
import com.zju.account.dto.request.ReissueSecurityAccountRequest;
import com.zju.account.dto.request.ReportSecurityLossRequest;
import com.zju.account.service.SecurityAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 内部 / 工作人员证券账户管理接口。
 * 严格对齐《数据库具体设计与对外接口说明》§7.2，字段使用 snake_case。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/internal/security")
@RequiredArgsConstructor
public class SecurityAccountController {

    private final SecurityAccountService securityAccountService;

    /** §7.2.1 createSecurityAccount —— 开设证券账户 */
    @PostMapping("/accounts")
    public Result<Void> createSecurityAccount(@Valid @RequestBody CreateSecurityAccountRequest request) {
        log.info("[createSecurityAccount] name={} id_number={} staff_id={}",
                request.getName(), request.getIdNumber(), request.getStaffId());
        try {
            Object data = securityAccountService.createSecurityAccount(request);
            return wrap(data, "开户成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[createSecurityAccount] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("开户成功")
                    .put("sec_acc_no", "S" + System.currentTimeMillis())
                    .put("status", "正常");
        }
    }

    /** §7.2.2 reportSecurityLoss —— 证券账户挂失 */
    @PostMapping("/accounts/loss")
    public Result<Void> reportSecurityLoss(@Valid @RequestBody ReportSecurityLossRequest request) {
        log.info("[reportSecurityLoss] sec_acc_no={} staff_id={} reason={}",
                request.getSecAccNo(), request.getStaffId(), request.getReason());
        try {
            Object data = securityAccountService.reportSecurityLoss(request);
            return wrap(data, "挂失成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[reportSecurityLoss] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("挂失成功").put("status", "挂失冻结");
        }
    }

    /** §7.2.3 reissueSecurityAccount —— 补办证券账户 */
    @PostMapping("/accounts/reissue")
    public Result<Void> reissueSecurityAccount(@Valid @RequestBody ReissueSecurityAccountRequest request) {
        log.info("[reissueSecurityAccount] old_sec_acc_no={} staff_id={}",
                request.getOldSecAccNo(), request.getStaffId());
        try {
            Object data = securityAccountService.reissueSecurityAccount(request);
            return wrap(data, "补办成功");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[reissueSecurityAccount] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("补办成功")
                    .put("new_sec_acc_no", "S" + System.currentTimeMillis());
        }
    }

    /** §7.2.4 closeSecurityAccount —— 销户证券账户 */
    @PostMapping("/accounts/close")
    public Result<Void> closeSecurityAccount(@Valid @RequestBody CloseSecurityAccountRequest request) {
        log.info("[closeSecurityAccount] sec_acc_no={} staff_id={} reason={}",
                request.getSecAccNo(), request.getStaffId(), request.getReason());
        try {
            Object data = securityAccountService.closeSecurityAccount(request);
            return wrap(data, "销户处理完成");
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[closeSecurityAccount] Service 未就绪，返回 Mock 数据");
            // 有持仓返回预销户，无持仓返回已销户；Mock 阶段统一返回预销户便于联调
            return Result.<Void>success("销户处理完成").put("status", "预销户");
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
