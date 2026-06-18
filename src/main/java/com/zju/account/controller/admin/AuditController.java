package com.zju.account.controller.admin;

import com.zju.account.common.Result;
import com.zju.account.dto.response.OperationLogView;
import com.zju.account.service.AuditService;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/** 审计接口：§7.4.1 queryOperationLog —— 查询工作人员操作日志 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/admin/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/operation-logs")
    public Result<Void> queryOperationLog(
            @RequestParam("staff_id") @NotNull Integer staffId,
            @RequestParam("time_from") @NotNull
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeFrom,
            @RequestParam("time_to") @NotNull
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeTo,
            @RequestParam(value = "operation_type", required = false) String operationType,
            @RequestParam(value = "target_type", required = false) String targetType,
            @RequestParam(value = "target_id", required = false) String targetId) {
        log.info("[queryOperationLog] staff_id={} from={} to={} operation_type={}",
                staffId, timeFrom, timeTo, operationType);
        try {
            Object data = auditService.queryOperationLog(staffId, timeFrom, timeTo,
                    operationType, targetType, targetId);
            if (data instanceof java.util.Map<?, ?> m) {
                Result<Void> r = Result.success("查询成功");
                ((java.util.Map<String, Object>) m).forEach((k, v) -> r.put(String.valueOf(k), v));
                return r;
            }
            return Result.<Void>success("查询成功").put("logs", data);
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[queryOperationLog] Service 未就绪，返回 Mock 数据");
            List<OperationLogView> mockLogs = List.of(
                    OperationLogView.builder()
                            .logId(1L).staffId(staffId)
                            .operationType("证券开户").targetType("SECURITY")
                            .targetId("S100000001").detail("个人投资者开户")
                            .operationTime(LocalDateTime.now().minusDays(1))
                            .build(),
                    OperationLogView.builder()
                            .logId(2L).staffId(staffId)
                            .operationType("资金存款").targetType("FUND")
                            .targetId("F987654321").detail("存款 5000.00")
                            .operationTime(LocalDateTime.now().minusHours(3))
                            .build()
            );
            return Result.<Void>success("查询成功").put("logs", mockLogs);
        }
    }
}
