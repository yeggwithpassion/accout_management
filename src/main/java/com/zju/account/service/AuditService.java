package com.zju.account.service;

import java.time.LocalDateTime;

/** 操作日志查询。 */
public interface AuditService {

    default Object queryOperationLog(Integer staffId,
                                     LocalDateTime timeFrom,
                                     LocalDateTime timeTo,
                                     String operationType,
                                     String targetType,
                                     String targetId) {
        throw new UnsupportedOperationException("queryOperationLog not implemented yet");
    }
}
