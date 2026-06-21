package account.controller.external;

import account.common.AuthHeaders;
import account.common.BusinessException;
import account.common.ErrorCode;
import account.common.Result;
import account.common.ResultPayloadMapper;
import account.service.api.AuditService;
import account.service.api.StaffAuthTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@Validated
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
public class AuditController {

    private static final String TRADE_ADMIN_USERNAME = "tradeadmin";

    private final AuditService auditService;
    private final StaffAuthTokenService staffAuthTokenService;
    private final ObjectMapper objectMapper;

    @GetMapping("/operation-logs")
    public Result<Void> queryOperationLog(
            @RequestHeader(AuthHeaders.STAFF_AUTH_TOKEN) String authToken,
            @RequestParam(value = "staff_id", required = false) Integer staffId,
            @RequestParam("time_from")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeFrom,
            @RequestParam("time_to")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeTo,
            @RequestParam(value = "operation_type", required = false) String operationType,
            @RequestParam(value = "target_type", required = false) String targetType,
            @RequestParam(value = "target_id", required = false) String targetId) {
        var session = requireTradeAdmin(authToken);
        Integer operatorStaffId = session.staffId();
        log.info("[queryOperationLog] operator_staff_id={} query_staff_id={} from={} to={} operation_type={}",
                operatorStaffId, staffId, timeFrom, timeTo, operationType);
        return ResultPayloadMapper.flatten(
                objectMapper,
                auditService.queryOperationLog(operatorStaffId, staffId, timeFrom, timeTo, operationType, targetType, targetId),
                "查询成功"
        );
    }

    private StaffAuthTokenService.AuthSession requireTradeAdmin(String authToken) {
        var session = staffAuthTokenService.requireAccess(authToken);
        if (!TRADE_ADMIN_USERNAME.equalsIgnoreCase(session.username())) {
            throw new BusinessException(ErrorCode.ERR_018, "仅 tradeadmin 可调用审计接口");
        }
        return session;
    }
}
