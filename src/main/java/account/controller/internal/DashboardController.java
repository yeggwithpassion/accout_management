package account.controller.internal;

import account.common.AuthHeaders;
import account.common.Result;
import account.dao.DaoRegistry;
import account.dao.model.DomainEnums;
import account.dto.DashboardStatsResponse;
import account.dto.OperationLogView;
import account.service.api.StaffAuthTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/internal/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DaoRegistry dao;
    private final StaffAuthTokenService staffAuthTokenService;

    @GetMapping("/stats")
    public Result<DashboardStatsResponse> getStats(
            @RequestHeader(AuthHeaders.STAFF_AUTH_TOKEN) String authToken) {
        Integer staffId = requireStaffId(authToken);
        log.info("[getStats] staff_id={}", staffId);

        long securityCount = dao.securityAccountDao().listAll().size();
        long fundCount = dao.fundAccountDao().listAll().size();
        
        // 今日新开账户数
        LocalDate today = LocalDate.now();
        long todayNewSec = dao.securityAccountDao().listAll().stream()
                .filter(a -> a.openDate().equals(today))
                .count();
        long todayNewFund = dao.fundAccountDao().listAll().stream()
                .filter(a -> a.openDate().equals(today))
                .count();
        
        // 异常账户数（冻结状态）
        long abnormalCount = dao.securityAccountDao().listAll().stream()
                .filter(a -> a.status() == DomainEnums.AccountStatus.LOSS_FROZEN 
                        || a.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN
                        || a.status() == DomainEnums.AccountStatus.NO_FUND_FROZEN)
                .count();
        abnormalCount += dao.fundAccountDao().listAll().stream()
                .filter(a -> a.status() == DomainEnums.AccountStatus.LOSS_FROZEN 
                        || a.status() == DomainEnums.AccountStatus.VIOLATION_FROZEN)
                .count();

        return Result.success(DashboardStatsResponse.builder()
                .securityAccountCount(securityCount)
                .fundAccountCount(fundCount)
                .todayNewAccounts(todayNewSec + todayNewFund)
                .abnormalAccountCount(abnormalCount)
                .build());
    }

    @GetMapping("/recent-logs")
    public Result<List<OperationLogView>> getRecentLogs(
            @RequestHeader(AuthHeaders.STAFF_AUTH_TOKEN) String authToken,
            @RequestParam(defaultValue = "10") int limit) {
        Integer staffId = requireStaffId(authToken);
        log.info("[getRecentLogs] staff_id={} limit={}", staffId, limit);

        List<account.dao.model.DomainModels.OperationLog> logs = dao.operationLogDao().listRecent(limit);
        List<OperationLogView> views = logs.stream().map(log -> OperationLogView.builder()
                .logId(log.logId())
                .staffId(log.staffId())
                .operationType(log.operationType())
                .targetType(log.targetType())
                .targetId(log.targetId())
                .detail(log.detail())
                .operationTime(log.operationTime())
                .build()).toList();

        return Result.success(views);
    }

    private Integer requireStaffId(String authToken) {
        return staffAuthTokenService.requireAccess(authToken).staffId();
    }
}