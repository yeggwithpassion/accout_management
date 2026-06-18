package com.zju.account.service.impl;

import account.dao.DaoRegistry;
import account.dao.model.DomainModels;
import com.zju.account.dto.response.OperationLogView;
import com.zju.account.service.AuditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 审计日志查询 Service 实现。
 */
@Slf4j
@Service
public class AuditServiceImpl implements AuditService {

    private final DaoRegistry dao;

    public AuditServiceImpl(DaoRegistry dao) {
        this.dao = dao;
    }

    @Override
    public Map<String, Object> queryOperationLog(Integer staffId,
                                                  LocalDateTime timeFrom,
                                                  LocalDateTime timeTo,
                                                  String operationType,
                                                  String targetType,
                                                  String targetId) {
        var query = new DomainModels.OperationLogQuery(
                staffId, timeFrom, timeTo, operationType, targetType, targetId, 200, 0
        );

        var logs = dao.operationLogDao().query(query);

        List<OperationLogView> logViews = logs.stream()
                .map(log -> OperationLogView.builder()
                        .logId(log.logId())
                        .staffId(log.staffId())
                        .operationType(log.operationType())
                        .targetType(log.targetType())
                        .targetId(log.targetId())
                        .detail(log.detail())
                        .operationTime(log.operationTime())
                        .build())
                .toList();

        log.info("[queryOperationLog] staff_id={} time_from={} time_to={} count={}",
                staffId, timeFrom, timeTo, logViews.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("logs", logViews);
        result.put("total", logViews.size());
        return result;
    }
}
